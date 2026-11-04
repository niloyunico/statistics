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
/* ===== dose-library.js ===== */
/* UNICO — the built-in dose library (Medicine & Rx → Dose Calculator).

   WHAT THIS IS: a curated starting list of standard ICU infusion concentrations, usual
   dose ranges, emergency weight-based doses and common paediatric doses, taken from the
   widely published references named on each entry (ICU infusion guidelines, AHA PALS /
   ACLS 2020, BNF for Children, product labels). It is NOT pulled from the monographs —
   those state a machine-readable rate for only ~1 drug in 10 (see medicine.jsx).

   WHAT IT IS NOT: hospital protocol. Every entry shows "Not yet reviewed" in the
   calculator until an administrator / pharmacist checks it against local protocol and
   signs it off (server/medicines.js → doseLibrary). Hospital edits are stored as
   overrides on top of this file, so a change here re-flags a reviewed entry as
   "Changed since review" (dose-math.js → mergeLibrary hashes the content).

   Ranges: `soft` = usual range (outside it the calculator warns), `hard` = the ceiling
   above which it refuses to print a label. `start` / `step` = usual starting dose and
   titration step. Units are spelled out in `unit`; concentrations are amount + unit in
   ml. Shared with the server and the tests via require(). */
(function (root) {
  const ICU = 'Standard adult ICU infusion references (UKCPA / ICS critical care infusion guides, SCCM sedation guideline)';
  const PALS = 'AHA PALS / ACLS 2020, APLS 7th ed.';
  const BNFC = 'BNF for Children 2024–25; WHO Pocket Book of Hospital Care for Children';

  // ---- ICU infusions ----------------------------------------------------------------
  const INFUSIONS = [
    // Vasopressors & inotropes
    { id: 'inf-noradrenaline', name: 'Noradrenaline (norepinephrine)', group: 'Vasopressors & inotropes', unit: 'mcg/kg/min',
      conc: [{ label: 'Single strength', amount: 4, unit: 'mg', ml: 50 }, { label: 'Double strength', amount: 8, unit: 'mg', ml: 50 }, { label: 'Quad strength', amount: 16, unit: 'mg', ml: 50 }],
      ampoule: { amount: 4, unit: 'mg', ml: 4, label: '4 mg / 4 mL ampoule' }, diluent: 'D5W or NS',
      soft: [0.01, 1], hard: 3, start: 0.05, step: 0.02, highAlert: true,
      notes: 'Central line preferred. Titrate to MAP target (usually ≥ 65 mmHg). Never flush the line — it boluses the drug.', source: ICU },
    { id: 'inf-adrenaline', name: 'Adrenaline (epinephrine)', group: 'Vasopressors & inotropes', unit: 'mcg/kg/min',
      conc: [{ label: 'Standard', amount: 4, unit: 'mg', ml: 50 }, { label: 'Dilute', amount: 2, unit: 'mg', ml: 50 }],
      ampoule: { amount: 1, unit: 'mg', ml: 1, label: '1 mg / 1 mL (1:1000) ampoule' }, diluent: 'D5W or NS',
      soft: [0.01, 0.5], hard: 2, start: 0.02, step: 0.01, highAlert: true,
      notes: 'Watch lactate and glucose (β2 effect raises both). Central line preferred.', source: ICU },
    { id: 'inf-dopamine', name: 'Dopamine', group: 'Vasopressors & inotropes', unit: 'mcg/kg/min',
      conc: [{ label: 'Standard', amount: 200, unit: 'mg', ml: 50 }, { label: 'Concentrated', amount: 400, unit: 'mg', ml: 50 }],
      ampoule: { amount: 200, unit: 'mg', ml: 5, label: '200 mg / 5 mL ampoule' }, diluent: 'D5W or NS',
      soft: [2, 20], hard: 30, start: 5, step: 2.5, highAlert: true,
      notes: 'Arrhythmogenic; noradrenaline is preferred first-line in septic shock. Extravasation: phentolamine.', source: ICU },
    { id: 'inf-dobutamine', name: 'Dobutamine', group: 'Vasopressors & inotropes', unit: 'mcg/kg/min',
      conc: [{ label: 'Standard', amount: 250, unit: 'mg', ml: 50 }, { label: 'Concentrated', amount: 500, unit: 'mg', ml: 50 }],
      ampoule: { amount: 250, unit: 'mg', ml: 20, label: '250 mg / 20 mL vial' }, diluent: 'D5W or NS',
      soft: [2, 20], hard: 40, start: 2.5, step: 2.5, highAlert: true,
      notes: 'Inotrope — can cause hypotension and tachyarrhythmia. Usually combined with a vasopressor in shock.', source: ICU },
    { id: 'inf-vasopressin', name: 'Vasopressin', group: 'Vasopressors & inotropes', unit: 'units/min',
      conc: [{ label: 'Standard', amount: 20, unit: 'units', ml: 100 }, { label: 'Syringe', amount: 20, unit: 'units', ml: 50 }],
      ampoule: { amount: 20, unit: 'units', ml: 1, label: '20 units / 1 mL ampoule' }, diluent: 'NS or D5W',
      soft: [0.01, 0.04], hard: 0.07, start: 0.03, step: 0.01, highAlert: true,
      notes: 'Not weight-based. Usually a fixed 0.03 units/min added to noradrenaline; not titrated like a catecholamine.', source: ICU },
    { id: 'inf-phenylephrine', name: 'Phenylephrine', group: 'Vasopressors & inotropes', unit: 'mcg/min',
      conc: [{ label: 'Standard', amount: 10, unit: 'mg', ml: 100 }, { label: 'Syringe', amount: 10, unit: 'mg', ml: 50 }],
      ampoule: { amount: 10, unit: 'mg', ml: 1, label: '10 mg / 1 mL ampoule' }, diluent: 'NS or D5W',
      soft: [10, 200], hard: 400, start: 20, step: 10, highAlert: true,
      notes: 'Pure α-agonist — reflex bradycardia. Peripheral use acceptable short-term.', source: ICU },
    { id: 'inf-milrinone', name: 'Milrinone', group: 'Vasopressors & inotropes', unit: 'mcg/kg/min',
      conc: [{ label: 'Standard', amount: 10, unit: 'mg', ml: 50 }, { label: 'Bag', amount: 20, unit: 'mg', ml: 100 }],
      ampoule: { amount: 10, unit: 'mg', ml: 10, label: '10 mg / 10 mL ampoule' }, diluent: 'NS or D5W',
      soft: [0.125, 0.75], hard: 1, start: 0.375, step: 0.125, highAlert: true,
      notes: 'Reduce in renal impairment. Vasodilates — expect a fall in BP. Loading dose often omitted.', source: ICU },
    { id: 'inf-isoprenaline', name: 'Isoprenaline (isoproterenol)', group: 'Vasopressors & inotropes', unit: 'mcg/min',
      conc: [{ label: 'Standard', amount: 1, unit: 'mg', ml: 50 }],
      ampoule: { amount: 0.2, unit: 'mg', ml: 1, label: '0.2 mg / 1 mL ampoule' }, diluent: 'D5W',
      soft: [0.5, 10], hard: 20, start: 1, step: 0.5, highAlert: true,
      notes: 'Bridge for symptomatic bradycardia / heart block until pacing.', source: ICU },

    // Vasodilators & antiarrhythmics
    { id: 'inf-gtn', name: 'Glyceryl trinitrate (GTN)', group: 'Vasodilators & antiarrhythmics', unit: 'mcg/min',
      conc: [{ label: 'Standard', amount: 50, unit: 'mg', ml: 50 }],
      ampoule: { amount: 50, unit: 'mg', ml: 10, label: '50 mg / 10 mL ampoule' }, diluent: 'NS or D5W',
      soft: [5, 200], hard: 400, start: 10, step: 10,
      notes: 'Use non-PVC / polyethylene lines (PVC absorbs GTN). Tolerance after 24 h. Headache is common.', source: ICU },
    { id: 'inf-nitroprusside', name: 'Sodium nitroprusside', group: 'Vasodilators & antiarrhythmics', unit: 'mcg/kg/min',
      conc: [{ label: 'Standard', amount: 50, unit: 'mg', ml: 50 }],
      ampoule: { amount: 50, unit: 'mg', ml: 2, label: '50 mg vial (reconstitute to 2 mL)' }, diluent: 'D5W only',
      soft: [0.3, 3], hard: 10, start: 0.3, step: 0.3, highAlert: true,
      notes: 'Protect from light. Doses above 2 mcg/kg/min risk cyanide toxicity — 10 mcg/kg/min for no more than 10 minutes. Arterial line required.', source: ICU },
    { id: 'inf-labetalol', name: 'Labetalol', group: 'Vasodilators & antiarrhythmics', unit: 'mg/h',
      conc: [{ label: 'Undiluted', amount: 100, unit: 'mg', ml: 20 }, { label: 'Diluted', amount: 100, unit: 'mg', ml: 100 }],
      ampoule: { amount: 100, unit: 'mg', ml: 20, label: '100 mg / 20 mL ampoule' }, diluent: 'NS or D5W',
      soft: [30, 120], hard: 180, start: 30, step: 15,
      notes: 'Avoid in asthma, heart block, acute heart failure. Pre-eclampsia: follow the obstetric protocol.', source: ICU },
    { id: 'inf-esmolol', name: 'Esmolol', group: 'Vasodilators & antiarrhythmics', unit: 'mcg/kg/min',
      conc: [{ label: 'Bag', amount: 2500, unit: 'mg', ml: 250 }, { label: 'Syringe', amount: 500, unit: 'mg', ml: 50 }],
      ampoule: { amount: 100, unit: 'mg', ml: 10, label: '100 mg / 10 mL vial' }, diluent: 'NS or D5W',
      soft: [50, 200], hard: 300, start: 50, step: 50,
      notes: 'Ultra-short acting β-blocker. Loading 500 mcg/kg over 1 min often given first.', source: ICU },
    { id: 'inf-amiodarone', name: 'Amiodarone', group: 'Vasodilators & antiarrhythmics', unit: 'mg/h',
      conc: [{ label: 'Peripheral bag', amount: 900, unit: 'mg', ml: 500 }, { label: 'Central syringe', amount: 300, unit: 'mg', ml: 50 }],
      ampoule: { amount: 150, unit: 'mg', ml: 3, label: '150 mg / 3 mL ampoule' }, diluent: 'D5W ONLY',
      soft: [30, 60], hard: 92, start: 60, step: 30, weight: 'none',
      notes: '1 mg/min (60 mg/h) for 6 h, then 0.5 mg/min (30 mg/h) for 18 h. Max 2.2 g in 24 h. D5W only; filter; central if > 2 mg/mL.', source: ICU },
    { id: 'inf-diltiazem', name: 'Diltiazem', group: 'Vasodilators & antiarrhythmics', unit: 'mg/h',
      conc: [{ label: 'Standard', amount: 125, unit: 'mg', ml: 125 }],
      ampoule: { amount: 25, unit: 'mg', ml: 5, label: '25 mg / 5 mL vial' }, diluent: 'NS or D5W',
      soft: [5, 15], hard: 20, start: 10, step: 2.5,
      notes: 'Rate control in AF. Avoid in decompensated heart failure and WPW.', source: ICU },
    { id: 'inf-lidocaine', name: 'Lidocaine (antiarrhythmic)', group: 'Vasodilators & antiarrhythmics', unit: 'mg/min',
      conc: [{ label: 'Standard', amount: 1000, unit: 'mg', ml: 250 }, { label: 'Syringe', amount: 500, unit: 'mg', ml: 50 }],
      ampoule: { amount: 100, unit: 'mg', ml: 5, label: '2% — 100 mg / 5 mL' }, diluent: 'D5W or NS',
      soft: [1, 4], hard: 4, start: 1, step: 1,
      notes: 'Reduce in heart failure and liver disease; toxicity = perioral numbness, confusion, seizures.', source: ICU },
    { id: 'inf-nimodipine', name: 'Nimodipine', group: 'Vasodilators & antiarrhythmics', unit: 'mg/h',
      conc: [{ label: 'Undiluted', amount: 10, unit: 'mg', ml: 50 }],
      ampoule: { amount: 10, unit: 'mg', ml: 50, label: '10 mg / 50 mL vial' }, diluent: 'Run with a co-infusion (NS)',
      soft: [0.5, 2], hard: 2, start: 1, step: 0.5, weight: 'none',
      notes: 'Subarachnoid haemorrhage. Start 1 mg/h, 2 mg/h after 2 h if BP stable. Protect from light; non-PVC line.', source: ICU },

    // Sedation & analgesia
    { id: 'inf-midazolam', name: 'Midazolam', group: 'Sedation & analgesia', unit: 'mg/kg/h',
      conc: [{ label: 'Standard', amount: 50, unit: 'mg', ml: 50 }, { label: 'Concentrated', amount: 100, unit: 'mg', ml: 50 }],
      ampoule: { amount: 15, unit: 'mg', ml: 3, label: '15 mg / 3 mL ampoule' }, diluent: 'NS or D5W',
      soft: [0.02, 0.1], hard: 0.2, start: 0.02, step: 0.01, highAlert: true,
      notes: 'Accumulates in renal / hepatic failure and obesity — consider ideal body weight. Daily sedation hold.', source: ICU },
    { id: 'inf-propofol', name: 'Propofol 1%', group: 'Sedation & analgesia', unit: 'mg/kg/h',
      conc: [{ label: '1% undiluted', amount: 500, unit: 'mg', ml: 50 }, { label: '2% undiluted', amount: 1000, unit: 'mg', ml: 50 }],
      ampoule: { amount: 200, unit: 'mg', ml: 20, label: '1% — 200 mg / 20 mL ampoule' }, diluent: 'Undiluted',
      soft: [0.3, 3], hard: 4, start: 1, step: 0.5, highAlert: true,
      notes: 'Above 4 mg/kg/h risks propofol infusion syndrome. Change syringe and line every 12 h. Counts as fat calories (1.1 kcal/mL).', source: ICU },
    { id: 'inf-fentanyl', name: 'Fentanyl', group: 'Sedation & analgesia', unit: 'mcg/kg/h',
      conc: [{ label: 'Standard', amount: 500, unit: 'mcg', ml: 50 }, { label: 'Concentrated', amount: 1000, unit: 'mcg', ml: 50 }],
      ampoule: { amount: 100, unit: 'mcg', ml: 2, label: '100 mcg / 2 mL ampoule' }, diluent: 'NS',
      soft: [0.5, 3], hard: 10, start: 1, step: 0.5, highAlert: true,
      notes: 'Opioid. Accumulates with prolonged infusion. Naloxone at the bedside.', source: ICU },
    { id: 'inf-morphine', name: 'Morphine', group: 'Sedation & analgesia', unit: 'mg/h',
      conc: [{ label: 'Standard', amount: 50, unit: 'mg', ml: 50 }],
      ampoule: { amount: 10, unit: 'mg', ml: 1, label: '10 mg / 1 mL ampoule' }, diluent: 'NS',
      soft: [1, 10], hard: 30, start: 2, step: 1, weight: 'none', highAlert: true,
      notes: 'Active metabolites accumulate in renal failure — prefer fentanyl. Monitor RR and sedation score.', source: ICU },
    { id: 'inf-dexmedetomidine', name: 'Dexmedetomidine', group: 'Sedation & analgesia', unit: 'mcg/kg/h',
      conc: [{ label: 'Standard', amount: 200, unit: 'mcg', ml: 50 }, { label: 'Bag', amount: 400, unit: 'mcg', ml: 100 }],
      ampoule: { amount: 200, unit: 'mcg', ml: 2, label: '200 mcg / 2 mL vial' }, diluent: 'NS',
      soft: [0.2, 0.7], hard: 1.5, start: 0.4, step: 0.1,
      notes: 'Bradycardia and hypotension; loading dose usually omitted in ICU. Light sedation without respiratory depression.', source: ICU },
    { id: 'inf-ketamine', name: 'Ketamine', group: 'Sedation & analgesia', unit: 'mg/kg/h',
      conc: [{ label: 'Standard', amount: 500, unit: 'mg', ml: 50 }],
      ampoule: { amount: 500, unit: 'mg', ml: 10, label: '500 mg / 10 mL vial' }, diluent: 'NS or D5W',
      soft: [0.1, 1], hard: 3, start: 0.2, step: 0.1,
      notes: 'Analgesic doses 0.1–0.3 mg/kg/h; sedation up to 1–2 mg/kg/h. Emergence reactions; raises BP/HR.', source: ICU },

    // Neuromuscular blockers
    { id: 'inf-atracurium', name: 'Atracurium', group: 'Neuromuscular blockers', unit: 'mg/kg/h',
      conc: [{ label: 'Undiluted', amount: 500, unit: 'mg', ml: 50 }],
      ampoule: { amount: 50, unit: 'mg', ml: 5, label: '50 mg / 5 mL ampoule' }, diluent: 'Undiluted or NS',
      soft: [0.3, 0.6], hard: 1.2, start: 0.5, step: 0.1, weight: 'ideal', highAlert: true,
      notes: 'PARALYTIC — patient must be sedated and ventilated. Hofmann elimination (safe in renal/hepatic failure). Train-of-four monitoring.', source: ICU },
    { id: 'inf-cisatracurium', name: 'Cisatracurium', group: 'Neuromuscular blockers', unit: 'mcg/kg/min',
      conc: [{ label: 'Undiluted', amount: 100, unit: 'mg', ml: 50 }],
      ampoule: { amount: 10, unit: 'mg', ml: 5, label: '10 mg / 5 mL ampoule' }, diluent: 'Undiluted or NS',
      soft: [1, 3], hard: 10, start: 1.5, step: 0.5, weight: 'ideal', highAlert: true,
      notes: 'PARALYTIC — sedate and ventilate first. ARDS regimen (ACURASYS) uses 37.5 mg/h fixed. Train-of-four monitoring.', source: ICU },
    { id: 'inf-vecuronium', name: 'Vecuronium', group: 'Neuromuscular blockers', unit: 'mcg/kg/min',
      conc: [{ label: 'Standard', amount: 50, unit: 'mg', ml: 50 }],
      ampoule: { amount: 10, unit: 'mg', ml: 10, label: '10 mg vial (reconstitute to 10 mL)' }, diluent: 'NS or D5W',
      soft: [0.8, 1.7], hard: 2, start: 1, step: 0.2, weight: 'ideal', highAlert: true,
      notes: 'PARALYTIC — sedate and ventilate first. Accumulates in renal/hepatic failure.', source: ICU },
    { id: 'inf-rocuronium', name: 'Rocuronium', group: 'Neuromuscular blockers', unit: 'mcg/kg/min',
      conc: [{ label: 'Undiluted', amount: 500, unit: 'mg', ml: 50 }],
      ampoule: { amount: 50, unit: 'mg', ml: 5, label: '50 mg / 5 mL vial' }, diluent: 'Undiluted or NS',
      soft: [8, 12], hard: 16, start: 10, step: 1, weight: 'ideal', highAlert: true,
      notes: 'PARALYTIC — sedate and ventilate first. Reversal: sugammadex.', source: ICU },

    // Endocrine, anticoagulation, renal
    { id: 'inf-insulin-vrii', name: 'Insulin (variable-rate, VRII)', group: 'Insulin, heparin & others', unit: 'units/h',
      conc: [{ label: 'Standard', amount: 50, unit: 'units', ml: 50 }],
      ampoule: { amount: 1000, unit: 'units', ml: 10, label: 'Soluble insulin 100 units/mL, 10 mL vial' }, diluent: 'NS',
      soft: [0.5, 10], hard: 20, start: 2, step: 0.5, weight: 'none', highAlert: true,
      notes: 'Rate from the hospital sliding scale against hourly CBG. Run with a glucose-containing fluid. Draw insulin with an INSULIN syringe only.', source: ICU },
    { id: 'inf-insulin-dka', name: 'Insulin (DKA fixed-rate)', group: 'Insulin, heparin & others', unit: 'units/kg/h',
      conc: [{ label: 'Standard', amount: 50, unit: 'units', ml: 50 }],
      ampoule: { amount: 1000, unit: 'units', ml: 10, label: 'Soluble insulin 100 units/mL, 10 mL vial' }, diluent: 'NS',
      soft: [0.05, 0.14], hard: 0.2, start: 0.1, step: 0.05, highAlert: true,
      notes: 'DKA: 0.1 units/kg/h (max ~15 units/h). Add D10 when glucose < 14 mmol/L. Watch potassium.', source: 'JBDS DKA guideline 2023; ADA hyperglycaemic crises consensus 2024' },
    { id: 'inf-heparin', name: 'Heparin (unfractionated)', group: 'Insulin, heparin & others', unit: 'units/kg/h',
      conc: [{ label: 'Syringe', amount: 25000, unit: 'units', ml: 50 }, { label: 'Bag', amount: 25000, unit: 'units', ml: 500 }],
      ampoule: { amount: 25000, unit: 'units', ml: 5, label: '25,000 units / 5 mL vial' }, diluent: 'NS',
      soft: [12, 18], hard: 30, start: 18, step: 2, highAlert: true,
      notes: 'VTE: 80 units/kg bolus, 18 units/kg/h. ACS: 60 units/kg (max 4000), 12 units/kg/h (max 1000 units/h). Titrate to aPTT per nomogram.', source: 'Raschke weight-based heparin nomogram; ACC/AHA ACS guideline' },
    { id: 'inf-furosemide', name: 'Furosemide', group: 'Insulin, heparin & others', unit: 'mg/h',
      conc: [{ label: 'Undiluted', amount: 250, unit: 'mg', ml: 25 }, { label: 'Diluted', amount: 100, unit: 'mg', ml: 50 }],
      ampoule: { amount: 20, unit: 'mg', ml: 2, label: '20 mg / 2 mL ampoule' }, diluent: 'NS',
      soft: [5, 20], hard: 40, start: 5, step: 5, weight: 'none',
      notes: 'Ototoxic above 4 mg/min. Monitor urine output, K⁺, Mg²⁺, creatinine.', source: ICU },
    { id: 'inf-octreotide', name: 'Octreotide', group: 'Insulin, heparin & others', unit: 'mcg/h',
      conc: [{ label: 'Standard', amount: 500, unit: 'mcg', ml: 50 }],
      ampoule: { amount: 100, unit: 'mcg', ml: 1, label: '100 mcg / 1 mL ampoule' }, diluent: 'NS',
      soft: [25, 50], hard: 100, start: 50, step: 25, weight: 'none',
      notes: 'Variceal bleed: 50 mcg bolus then 50 mcg/h for 2–5 days.', source: 'Baveno VII consensus' },
    { id: 'inf-pantoprazole', name: 'Pantoprazole', group: 'Insulin, heparin & others', unit: 'mg/h',
      conc: [{ label: 'Standard', amount: 80, unit: 'mg', ml: 50 }],
      ampoule: { amount: 40, unit: 'mg', ml: 10, label: '40 mg vial (reconstitute to 10 mL)' }, diluent: 'NS',
      soft: [8, 8], hard: 10, start: 8, step: 1, weight: 'none',
      notes: 'High-risk peptic ulcer bleed after endoscopy: 80 mg bolus, 8 mg/h for 72 h (intermittent high-dose is an accepted alternative).', source: 'ACG upper GI bleeding guideline 2021' },
    { id: 'inf-magnesium', name: 'Magnesium sulphate', group: 'Insulin, heparin & others', unit: 'g/h',
      conc: [{ label: 'Syringe', amount: 5, unit: 'g', ml: 50 }, { label: 'Bag', amount: 20, unit: 'g', ml: 500 }],
      ampoule: { amount: 2.5, unit: 'g', ml: 5, label: '50% — 2.5 g / 5 mL ampoule' }, diluent: 'NS or D5W',
      soft: [0.5, 2], hard: 3, start: 1, step: 0.5, weight: 'none', highAlert: true,
      notes: 'Eclampsia: 4 g load over 5–15 min, then 1 g/h for 24 h. Check patellar reflex, RR > 12, urine > 25 mL/h. Antidote: calcium gluconate 10% 10 mL.', source: 'WHO / RCOG eclampsia (Zuspan) regimen' },
    { id: 'inf-potassium', name: 'Potassium chloride', group: 'Insulin, heparin & others', unit: 'mmol/h',
      conc: [{ label: 'Peripheral bag', amount: 40, unit: 'mmol', ml: 1000 }, { label: 'Central syringe', amount: 20, unit: 'mmol', ml: 50 }],
      ampoule: { amount: 20, unit: 'mmol', ml: 10, label: '15% KCl — 20 mmol / 10 mL' }, diluent: 'NS',
      soft: [5, 10], hard: 20, start: 10, step: 5, weight: 'none', highAlert: true,
      notes: 'NEVER as an IV push. Peripheral ≤ 10 mmol/h and ≤ 40 mmol/L; > 10 mmol/h only via central line with ECG monitoring.', source: 'ISMP high-alert medication list; NPSA potassium alert' },
    { id: 'inf-aminophylline', name: 'Aminophylline', group: 'Insulin, heparin & others', unit: 'mg/kg/h',
      conc: [{ label: 'Bag', amount: 500, unit: 'mg', ml: 500 }],
      ampoule: { amount: 250, unit: 'mg', ml: 10, label: '250 mg / 10 mL ampoule' }, diluent: 'NS or D5W',
      soft: [0.3, 0.7], hard: 0.9, start: 0.5, step: 0.1, weight: 'ideal',
      notes: 'Narrow therapeutic range — check theophylline level at 24 h. Skip the loading dose if already on oral theophylline.', source: 'BTS/SIGN asthma guideline' },
    { id: 'inf-salbutamol', name: 'Salbutamol IV', group: 'Insulin, heparin & others', unit: 'mcg/min',
      conc: [{ label: 'Standard', amount: 5, unit: 'mg', ml: 50 }],
      ampoule: { amount: 5, unit: 'mg', ml: 5, label: '5 mg / 5 mL ampoule' }, diluent: 'NS or D5W',
      soft: [3, 20], hard: 25, start: 5, step: 2,
      notes: 'Tachycardia, hypokalaemia and lactic acidosis. Check K⁺.', source: 'BTS/SIGN asthma guideline' },
    { id: 'inf-tranexamic', name: 'Tranexamic acid (maintenance)', group: 'Insulin, heparin & others', unit: 'mg/h',
      conc: [{ label: 'Bag', amount: 1000, unit: 'mg', ml: 100 }],
      ampoule: { amount: 500, unit: 'mg', ml: 5, label: '500 mg / 5 mL ampoule' }, diluent: 'NS',
      soft: [125, 125], hard: 150, start: 125, step: 25, weight: 'none',
      notes: 'Trauma (CRASH-2): 1 g over 10 min within 3 h of injury, then 1 g over 8 h (125 mg/h).', source: 'CRASH-2 trial regimen' },
    { id: 'inf-oxytocin', name: 'Oxytocin', group: 'Insulin, heparin & others', unit: 'milliunits/min',
      conc: [{ label: 'Standard', amount: 10, unit: 'units', ml: 500 }, { label: 'Syringe', amount: 10, unit: 'units', ml: 50 }],
      ampoule: { amount: 10, unit: 'units', ml: 1, label: '10 units / 1 mL ampoule' }, diluent: 'NS',
      soft: [1, 20], hard: 32, start: 2, step: 2, weight: 'none', highAlert: true,
      notes: 'Induction / augmentation: increase every 30 min per the obstetric protocol. Stop for > 5 contractions in 10 min or fetal distress.', source: 'WHO / NICE intrapartum care' },
  ];

  // ---- Emergency drug sheet (weight-based, one dose each) ----------------------------
  // dose = per-kg dose (number or [lo, hi]); unit = dose unit; max = single-dose ceiling;
  // adult = the dose used for an adult patient; mgPerMl = strength of the prepared form.
  const EMERGENCY = [
    { id: 'em-adrenaline-arrest', name: 'Adrenaline — cardiac arrest', group: 'Cardiac arrest', dose: 0.01, unit: 'mg', max: 1, adult: 1, perMl: 0.1, prep: '1:10,000 (1 mg in 10 mL)', route: 'IV / IO', notes: 'Every 3–5 min. Adults: 1 mg of 1:10,000 = 10 mL.', source: PALS },
    { id: 'em-amiodarone', name: 'Amiodarone — VF / pulseless VT', group: 'Cardiac arrest', dose: 5, unit: 'mg', max: 300, adult: 300, perMl: 50, prep: '150 mg / 3 mL', route: 'IV / IO', notes: 'After the 3rd shock. Adult 2nd dose 150 mg; child may repeat 5 mg/kg up to twice.', source: PALS },
    { id: 'em-lidocaine', name: 'Lidocaine — VF / pVT (alternative)', group: 'Cardiac arrest', dose: 1, unit: 'mg', max: 100, adult: 100, perMl: 20, prep: '2% (20 mg/mL)', route: 'IV / IO', notes: 'If amiodarone unavailable.', source: PALS },
    { id: 'em-calcium-chloride', name: 'Calcium chloride 10%', group: 'Cardiac arrest', dose: 20, unit: 'mg', max: 1000, adult: 1000, perMl: 100, prep: '10% (100 mg/mL)', route: 'IV (central preferred)', notes: 'Hyperkalaemia, hypocalcaemia, CCB overdose. Not routine in arrest.', source: PALS },
    { id: 'em-calcium-gluconate', name: 'Calcium gluconate 10%', group: 'Cardiac arrest', dose: 60, unit: 'mg', max: 3000, adult: 3000, perMl: 100, prep: '10% (100 mg/mL)', route: 'IV', notes: 'Peripheral-safe alternative to chloride (≈ ⅓ the calcium per mL).', source: PALS },
    { id: 'em-bicarbonate', name: 'Sodium bicarbonate 8.4%', group: 'Cardiac arrest', dose: 1, unit: 'mmol', max: 50, adult: 50, perMl: 1, prep: '8.4% (1 mmol/mL)', route: 'IV', notes: 'Hyperkalaemia, TCA overdose. Infants < 1 month: use 4.2%.', source: PALS },
    { id: 'em-dextrose', name: 'Dextrose 10% — hypoglycaemia', group: 'Cardiac arrest', dose: 0.5, unit: 'g', max: 25, adult: 25, perMl: 0.1, prep: 'D10 (0.1 g/mL)', route: 'IV / IO', notes: '5 mL/kg of D10. Recheck glucose after 15 min.', source: PALS },
    { id: 'em-atropine', name: 'Atropine — bradycardia', group: 'Cardiac arrest', dose: 0.02, unit: 'mg', min: 0.1, max: 0.5, adult: 1, perMl: 0.6, prep: '0.6 mg / 1 mL', route: 'IV / IO', notes: 'Child max single dose 0.5 mg; adult 1 mg every 3–5 min to 3 mg.', source: PALS },
    { id: 'em-adenosine-1', name: 'Adenosine — SVT 1st dose', group: 'Cardiac arrest', dose: 0.1, unit: 'mg', max: 6, adult: 6, perMl: 3, prep: '6 mg / 2 mL', route: 'Rapid IV + flush', notes: 'Fast push close to the heart with a 10–20 mL flush. Record ECG.', source: PALS },
    { id: 'em-adenosine-2', name: 'Adenosine — SVT 2nd dose', group: 'Cardiac arrest', dose: 0.2, unit: 'mg', max: 12, adult: 12, perMl: 3, prep: '6 mg / 2 mL', route: 'Rapid IV + flush', notes: '', source: PALS },
    { id: 'em-naloxone', name: 'Naloxone — opioid reversal', group: 'Cardiac arrest', dose: 0.1, unit: 'mg', max: 2, adult: 0.4, perMl: 0.4, prep: '0.4 mg / 1 mL', route: 'IV / IM / IO', notes: 'Adults: 0.4 mg, repeat every 2–3 min. Lower titrated doses if opioid-dependent.', source: PALS },
    { id: 'em-adrenaline-im', name: 'Adrenaline — anaphylaxis IM', group: 'Anaphylaxis & shock', dose: 0.01, unit: 'mg', max: 0.5, adult: 0.5, perMl: 1, prep: '1:1000 (1 mg/mL)', route: 'IM (thigh)', notes: 'Repeat after 5 min if no improvement.', source: 'Resuscitation Council UK anaphylaxis 2021' },
    { id: 'em-hydrocortisone', name: 'Hydrocortisone', group: 'Anaphylaxis & shock', dose: 2, unit: 'mg', max: 100, adult: 100, perMl: 50, prep: '100 mg / 2 mL', route: 'IV / IM', notes: 'Adrenal crisis: 100 mg adult, then 50 mg 6-hourly.', source: PALS },
    { id: 'em-fluid', name: 'Fluid bolus (NS / RL)', group: 'Anaphylaxis & shock', dose: [10, 20], unit: 'mL', max: 1000, adult: 500, perMl: null, prep: 'Crystalloid', route: 'IV / IO', notes: 'Reassess after every bolus. 10 mL/kg in cardiac disease, DKA, malnutrition.', source: PALS },
    { id: 'em-magnesium', name: 'Magnesium — torsades / severe asthma', group: 'Anaphylaxis & shock', dose: [25, 50], unit: 'mg', max: 2000, adult: 2000, perMl: 500, prep: '50% (500 mg/mL) — dilute', route: 'IV over 20 min', notes: 'Torsades: push in arrest. Dilute to ≤ 20% for a child.', source: PALS },

    { id: 'em-ketamine', name: 'Ketamine — induction', group: 'Intubation (RSI)', dose: [1, 2], unit: 'mg', perMl: 50, prep: '50 mg/mL', route: 'IV', notes: 'Haemodynamically stable choice in shock.', source: PALS },
    { id: 'em-etomidate', name: 'Etomidate — induction', group: 'Intubation (RSI)', dose: 0.3, unit: 'mg', max: 20, perMl: 2, prep: '2 mg/mL', route: 'IV', notes: 'Adrenal suppression; avoid in sepsis if alternatives exist.', source: PALS },
    { id: 'em-propofol', name: 'Propofol — induction', group: 'Intubation (RSI)', dose: [1, 2.5], unit: 'mg', perMl: 10, prep: '1% (10 mg/mL)', route: 'IV', notes: 'Reduce dose in shock / elderly — causes hypotension.', source: PALS },
    { id: 'em-fentanyl', name: 'Fentanyl — pre-treatment', group: 'Intubation (RSI)', dose: [1, 3], unit: 'mcg', max: 200, perMl: 50, prep: '50 mcg/mL', route: 'IV', notes: 'Give slowly; chest-wall rigidity with fast high doses.', source: PALS },
    { id: 'em-midazolam-sed', name: 'Midazolam — sedation', group: 'Intubation (RSI)', dose: 0.1, unit: 'mg', max: 5, perMl: 5, prep: '5 mg/mL', route: 'IV', notes: '', source: PALS },
    { id: 'em-rocuronium', name: 'Rocuronium — paralysis', group: 'Intubation (RSI)', dose: [1, 1.2], unit: 'mg', perMl: 10, prep: '10 mg/mL', route: 'IV', notes: 'PARALYTIC. Reversal: sugammadex 16 mg/kg.', source: PALS },
    { id: 'em-suxamethonium', name: 'Suxamethonium — paralysis', group: 'Intubation (RSI)', dose: 1.5, unit: 'mg', max: 150, perMl: 50, prep: '50 mg/mL', route: 'IV', notes: 'Infants 2 mg/kg. Avoid in hyperkalaemia, burns > 48 h, crush, neuromuscular disease.', source: PALS },

    { id: 'em-midazolam-seiz', name: 'Midazolam — seizure', group: 'Seizure', dose: 0.15, unit: 'mg', max: 10, adult: 10, perMl: 5, prep: '5 mg/mL', route: 'IV / IM / buccal (0.3 mg/kg)', notes: 'May repeat once after 5 min.', source: 'APLS status epilepticus; ESETT' },
    { id: 'em-diazepam', name: 'Diazepam — seizure', group: 'Seizure', dose: 0.3, unit: 'mg', max: 10, adult: 10, perMl: 5, prep: '5 mg/mL', route: 'IV (rectal 0.5 mg/kg)', notes: 'Respiratory depression — bag-valve-mask ready.', source: 'APLS status epilepticus' },
    { id: 'em-lorazepam', name: 'Lorazepam — seizure', group: 'Seizure', dose: 0.1, unit: 'mg', max: 4, adult: 4, perMl: 2, prep: '2 mg/mL', route: 'IV', notes: '', source: 'APLS status epilepticus' },
    { id: 'em-levetiracetam', name: 'Levetiracetam — loading', group: 'Seizure', dose: 60, unit: 'mg', max: 4500, adult: 4500, perMl: 100, prep: '500 mg / 5 mL', route: 'IV over 10 min', notes: '2nd-line for established status epilepticus.', source: 'ESETT trial; APLS' },
    { id: 'em-phenytoin', name: 'Phenytoin — loading', group: 'Seizure', dose: 20, unit: 'mg', max: 2000, adult: 2000, perMl: 50, prep: '250 mg / 5 mL', route: 'IV ≤ 1 mg/kg/min (max 50 mg/min)', notes: 'ECG + BP monitoring. NS only; filter.', source: 'APLS status epilepticus' },
    { id: 'em-phenobarbital', name: 'Phenobarbital — loading', group: 'Seizure', dose: 20, unit: 'mg', max: 1000, adult: 1000, perMl: 200, prep: '200 mg/mL', route: 'IV over 20 min', notes: 'Respiratory depression; neonatal first-line.', source: 'APLS status epilepticus' },
  ];

  // Electrical therapy: J/kg, capped at the adult energy.
  const ELECTRICAL = [
    { id: 'el-defib-1', name: 'Defibrillation — 1st shock', jPerKg: 2, adult: 200, notes: 'Biphasic adult 120–200 J (manufacturer); 360 J monophasic.' },
    { id: 'el-defib-2', name: 'Defibrillation — later shocks', jPerKg: 4, max: 10, adult: 200, notes: 'May escalate to 10 J/kg, not above the adult dose.' },
    { id: 'el-cardio-1', name: 'Synchronised cardioversion — 1st', jPerKg: [0.5, 1], adult: 120, notes: 'Narrow regular SVT/flutter adult: 50–100 J.' },
    { id: 'el-cardio-2', name: 'Synchronised cardioversion — later', jPerKg: 2, adult: 200, notes: '' },
  ];

  // ---- Paediatric weight-based doses ------------------------------------------------
  // mode 'dose' = mg/kg per dose; 'day' = mg/kg per DAY divided into `perDay` doses.
  // dose = [lo, hi] mg/kg (lo === hi for a single figure); maxDose / maxDay in mg.
  const PAEDIATRIC = [
    { id: 'pd-paracetamol', name: 'Paracetamol', group: 'Analgesic / antipyretic', mode: 'dose', dose: [10, 15], perDay: 4, maxDose: 1000, maxDayPerKg: 75, maxDay: 4000,
      strengths: [{ label: 'Suspension 120 mg/5 mL', mg: 120, ml: 5 }, { label: 'Drops 80 mg/mL', mg: 80, ml: 1 }, { label: 'Tablet 500 mg', mg: 500, form: 'tab' }, { label: 'IV 10 mg/mL', mg: 10, ml: 1 }],
      notes: 'Every 4–6 h, max 4 doses in 24 h. Neonates: 60 mg/kg/day max.', source: BNFC },
    { id: 'pd-ibuprofen', name: 'Ibuprofen', group: 'Analgesic / antipyretic', mode: 'dose', dose: [5, 10], perDay: 3, maxDose: 400, maxDayPerKg: 30, maxDay: 1200,
      strengths: [{ label: 'Suspension 100 mg/5 mL', mg: 100, ml: 5 }, { label: 'Tablet 200 mg', mg: 200, form: 'tab' }, { label: 'Tablet 400 mg', mg: 400, form: 'tab' }],
      notes: 'Not under 3 months or < 5 kg. Avoid in dehydration, dengue, renal impairment.', source: BNFC },
    { id: 'pd-amoxicillin', name: 'Amoxicillin', group: 'Antibiotics (oral)', mode: 'day', dose: [25, 50], perDay: 3, maxDose: 1000, maxDay: 3000,
      strengths: [{ label: 'Suspension 125 mg/5 mL', mg: 125, ml: 5 }, { label: 'Suspension 250 mg/5 mL', mg: 250, ml: 5 }, { label: 'Drops 125 mg/1.25 mL', mg: 100, ml: 1 }, { label: 'Capsule 250 mg', mg: 250, form: 'cap' }, { label: 'Capsule 500 mg', mg: 500, form: 'cap' }],
      notes: 'Divided 8-hourly. Severe infection up to 90 mg/kg/day (see high-dose).', source: BNFC },
    { id: 'pd-amoxicillin-hd', name: 'Amoxicillin (high dose)', group: 'Antibiotics (oral)', mode: 'day', dose: [80, 90], perDay: 2, maxDose: 2000, maxDay: 4000,
      strengths: [{ label: 'Suspension 250 mg/5 mL', mg: 250, ml: 5 }, { label: 'Capsule 500 mg', mg: 500, form: 'cap' }],
      notes: 'Pneumonia / acute otitis media (WHO, AAP). Divided 12-hourly.', source: BNFC },
    { id: 'pd-coamoxiclav', name: 'Co-amoxiclav (amoxicillin part)', group: 'Antibiotics (oral)', mode: 'day', dose: [25, 45], perDay: 2, maxDose: 875, maxDay: 1750,
      strengths: [{ label: '228.5 mg/5 mL (200 mg amox)', mg: 200, ml: 5 }, { label: '457 mg/5 mL (400 mg amox)', mg: 400, ml: 5 }, { label: '156.25 mg/5 mL (125 mg amox)', mg: 125, ml: 5 }],
      notes: 'Dose by the AMOXICILLIN component. 12-hourly with the 7:1 suspensions.', source: BNFC },
    { id: 'pd-azithromycin', name: 'Azithromycin', group: 'Antibiotics (oral)', mode: 'dose', dose: [10, 10], perDay: 1, maxDose: 500,
      strengths: [{ label: 'Suspension 200 mg/5 mL', mg: 200, ml: 5 }, { label: 'Tablet 250 mg', mg: 250, form: 'tab' }, { label: 'Tablet 500 mg', mg: 500, form: 'tab' }],
      notes: 'Once daily for 3 days (or 10 mg/kg day 1, then 5 mg/kg days 2–5). Enteric fever: 20 mg/kg (max 1 g) for 7 days.', source: BNFC },
    { id: 'pd-cefixime', name: 'Cefixime', group: 'Antibiotics (oral)', mode: 'day', dose: [8, 8], perDay: 2, maxDay: 400,
      strengths: [{ label: 'Suspension 100 mg/5 mL', mg: 100, ml: 5 }, { label: 'Capsule 200 mg', mg: 200, form: 'cap' }],
      notes: 'Once daily or divided 12-hourly. Enteric fever: 20 mg/kg/day.', source: BNFC },
    { id: 'pd-cefuroxime', name: 'Cefuroxime axetil', group: 'Antibiotics (oral)', mode: 'dose', dose: [10, 15], perDay: 2, maxDose: 500,
      strengths: [{ label: 'Suspension 125 mg/5 mL', mg: 125, ml: 5 }, { label: 'Tablet 250 mg', mg: 250, form: 'tab' }, { label: 'Tablet 500 mg', mg: 500, form: 'tab' }],
      notes: '12-hourly with food.', source: BNFC },
    { id: 'pd-cephalexin', name: 'Cephalexin', group: 'Antibiotics (oral)', mode: 'day', dose: [25, 50], perDay: 3, maxDose: 1000, maxDay: 4000,
      strengths: [{ label: 'Suspension 125 mg/5 mL', mg: 125, ml: 5 }, { label: 'Suspension 250 mg/5 mL', mg: 250, ml: 5 }, { label: 'Capsule 250 mg', mg: 250, form: 'cap' }, { label: 'Capsule 500 mg', mg: 500, form: 'cap' }],
      notes: 'Divided 8-hourly (or 6-hourly in severe infection).', source: BNFC },
    { id: 'pd-metronidazole', name: 'Metronidazole', group: 'Antibiotics (oral)', mode: 'dose', dose: [7.5, 7.5], perDay: 3, maxDose: 500,
      strengths: [{ label: 'Suspension 200 mg/5 mL', mg: 200, ml: 5 }, { label: 'Tablet 400 mg', mg: 400, form: 'tab' }, { label: 'IV 500 mg/100 mL', mg: 5, ml: 1 }],
      notes: '8-hourly. Amoebiasis: 10 mg/kg/dose.', source: BNFC },

    { id: 'pd-ceftriaxone', name: 'Ceftriaxone IV', group: 'Antibiotics (IV)', mode: 'day', dose: [50, 80], perDay: 1, maxDose: 2000, maxDay: 4000,
      strengths: [{ label: '1 g vial in 10 mL (100 mg/mL)', mg: 100, ml: 1 }, { label: '500 mg vial in 5 mL (100 mg/mL)', mg: 100, ml: 1 }],
      notes: 'Meningitis: 100 mg/kg/day (max 4 g). Not with calcium-containing fluids in neonates.', source: BNFC },
    { id: 'pd-ampicillin', name: 'Ampicillin IV', group: 'Antibiotics (IV)', mode: 'dose', dose: [50, 50], perDay: 4, maxDose: 2000,
      strengths: [{ label: '500 mg vial in 5 mL (100 mg/mL)', mg: 100, ml: 1 }],
      notes: '6-hourly. Neonates: by postnatal age per neonatal formulary.', source: BNFC },
    { id: 'pd-gentamicin', name: 'Gentamicin IV', group: 'Antibiotics (IV)', mode: 'dose', dose: [5, 7], perDay: 1, maxDose: 560,
      strengths: [{ label: '80 mg/2 mL (40 mg/mL)', mg: 40, ml: 1 }, { label: '20 mg/2 mL (10 mg/mL) paediatric', mg: 10, ml: 1 }],
      notes: 'Once daily; check trough level and renal function. Neonates per postnatal age.', source: BNFC },
    { id: 'pd-vancomycin', name: 'Vancomycin IV', group: 'Antibiotics (IV)', mode: 'dose', dose: [15, 15], perDay: 4, maxDose: 1000,
      strengths: [{ label: '500 mg vial in 10 mL (50 mg/mL)', mg: 50, ml: 1 }],
      notes: '6-hourly over ≥ 60 min (red-man). Level-guided dosing.', source: BNFC },

    { id: 'pd-ondansetron', name: 'Ondansetron', group: 'Other', mode: 'dose', dose: [0.15, 0.15], perDay: 3, maxDose: 4,
      strengths: [{ label: 'Syrup 4 mg/5 mL', mg: 4, ml: 5 }, { label: 'Injection 2 mg/mL', mg: 2, ml: 1 }, { label: 'Tablet 4 mg', mg: 4, form: 'tab' }],
      notes: 'Gastroenteritis: single dose. QT prolongation.', source: BNFC },
    { id: 'pd-prednisolone', name: 'Prednisolone', group: 'Other', mode: 'day', dose: [1, 2], perDay: 1, maxDay: 40,
      strengths: [{ label: 'Oral solution 5 mg/5 mL', mg: 5, ml: 5 }, { label: 'Tablet 5 mg', mg: 5, form: 'tab' }],
      notes: 'Asthma: 1–2 mg/kg once daily for 3 days (max 40 mg). Nephrotic: 60 mg/m² — use BSA.', source: BNFC },
    { id: 'pd-salbutamol', name: 'Salbutamol syrup', group: 'Other', mode: 'dose', dose: [0.1, 0.15], perDay: 3, maxDose: 4,
      strengths: [{ label: 'Syrup 2 mg/5 mL', mg: 2, ml: 5 }],
      notes: 'Inhaled route preferred. 8-hourly.', source: BNFC },
    { id: 'pd-dexamethasone', name: 'Dexamethasone (croup)', group: 'Other', mode: 'dose', dose: [0.15, 0.6], perDay: 1, maxDose: 10,
      strengths: [{ label: 'Injection 4 mg/mL', mg: 4, ml: 1 }, { label: 'Tablet 0.5 mg', mg: 0.5, form: 'tab' }],
      notes: 'Croup: single dose 0.15 mg/kg (mild) to 0.6 mg/kg (severe).', source: BNFC },
  ];

  // Clinical-calculator cards (ids only — the maths and inputs live in dose-math.js / dose-calc.jsx).
  const CALCS = ['body', 'renal', 'fluids', 'drip', 'sodium', 'freewater', 'electrolytes', 'parkland', 'convert'];

  const API = { VERSION: '2026-11-04', INFUSIONS: INFUSIONS, EMERGENCY: EMERGENCY, ELECTRICAL: ELECTRICAL, PAEDIATRIC: PAEDIATRIC, CALCS: CALCS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_DOSE_LIB = API;
})(typeof window !== 'undefined' ? window : null);

;
/* ===== dose-math.js ===== */
/* UNICO — the ONE dose-calculation engine (Medicine & Rx → Dose Calculator).
   Pure arithmetic, no React and no DOM, so the calculator, the server (review hashes)
   and server/test/dose-math.test.js all run exactly the same code.

   Units: amounts are converted through a base per family — mass in mcg, activity in
   units, substance in mmol, volume in mL. A dose unit is "<amount>[/kg]/<min|h>" (e.g.
   mcg/kg/min, units/h, g/h). A concentration is { amount, unit, ml }.

   Every function returns null (never NaN / Infinity) when an input is missing, so the
   UI can show "—" rather than a wrong number. */
(function (root) {
  const MASS = { g: 1e6, mg: 1e3, mcg: 1, ng: 1e-3 };
  const ACT = { units: 1, milliunits: 1e-3 };
  const SUB = { mmol: 1, mEq: 1 };
  const VOL = { L: 1000, mL: 1 };

  const fin = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
  const pos = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const numv = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
  const round = (n, dp) => { if (fin(n) == null) return null; const p = Math.pow(10, dp == null ? 2 : dp); return Math.round(n * p) / p; };

  function family(u) {
    if (MASS[u] != null) return ['mass', MASS[u]];
    if (ACT[u] != null) return ['act', ACT[u]];
    if (SUB[u] != null) return ['sub', SUB[u]];
    if (VOL[u] != null) return ['vol', VOL[u]];
    return null;
  }
  // Factor that turns an amount in `from` into `to`, or null when the families differ.
  function factor(from, to) {
    const a = family(from), b = family(to);
    if (!a || !b || a[0] !== b[0]) return null;
    return a[1] / b[1];
  }
  function convert(value, from, to) { const f = factor(from, to); const v = numv(value); return f == null || v == null ? null : v * f; }

  // "mcg/kg/min" → { amount:'mcg', perKg:true, perMin:true }
  function parseUnit(u) {
    const parts = String(u || '').split('/');
    return { amount: parts[0], perKg: parts.indexOf('kg') > 0, perMin: parts[parts.length - 1] === 'min', timed: parts.length > 1 && /^(min|h)$/.test(parts[parts.length - 1]) };
  }

  // Amount of drug per mL of the prepared solution, expressed in `inUnit`.
  function concPerMl(conc, inUnit) {
    if (!conc) return null;
    const amt = pos(conc.amount), ml = pos(conc.ml);
    if (amt == null || ml == null) return null;
    const f = factor(conc.unit, inUnit || conc.unit);
    return f == null ? null : (amt * f) / ml;
  }

  // dose (in doseUnit) → mL/h.
  function rateFromDose(o) {
    const u = parseUnit(o.unit), dose = numv(o.dose);
    if (dose == null || dose < 0) return null;
    const w = u.perKg ? pos(o.weight) : 1;
    if (w == null) return null;
    const c = concPerMl(o.conc, u.amount);
    if (c == null) return null;
    const perHour = dose * w * (u.perMin ? 60 : 1);
    return perHour / c;
  }
  // mL/h → dose (in doseUnit).
  function doseFromRate(o) {
    const u = parseUnit(o.unit), rate = numv(o.rate);
    if (rate == null || rate < 0) return null;
    const w = u.perKg ? pos(o.weight) : 1;
    if (w == null) return null;
    const c = concPerMl(o.conc, u.amount);
    if (c == null) return null;
    return (rate * c) / (w * (u.perMin ? 60 : 1));
  }

  // Pumps step in 0.1 mL/h (0.01 below 1 mL/h on most syringe drivers).
  function roundToPump(rate) {
    const r = numv(rate);
    if (r == null) return null;
    return r < 1 ? Math.round(r * 100) / 100 : Math.round(r * 10) / 10;
  }

  // 'ok' | 'low' | 'high' | 'hard'  (hard = above the ceiling; never printable)
  function checkLimits(entry, dose) {
    const d = numv(dose);
    if (d == null || !entry) return null;
    const soft = entry.soft || [], hard = numv(entry.hard);
    if (hard != null && d > hard + 1e-9) return 'hard';
    if (numv(soft[1]) != null && d > soft[1] + 1e-9) return 'high';
    if (numv(soft[0]) != null && d < soft[0] - 1e-9) return 'low';
    return 'ok';
  }

  // Bedside titration chart: dose steps from the low end to the ceiling, with mL/h.
  function titrationTable(entry, conc, weight, rows) {
    if (!entry) return [];
    const lo = numv((entry.soft || [])[0]), top = numv(entry.hard) || numv((entry.soft || [])[1]);
    const step = pos(entry.step);
    if (lo == null || top == null || step == null) return [];
    const out = [];
    const max = rows || 14;
    // Start at the first step at/below the usual minimum so the start dose is on the chart.
    let d = Math.max(step, Math.floor(lo / step) * step);
    if (lo < step) d = lo;
    for (let i = 0; i < 60 && out.length < max && d <= top + 1e-9; i++) {
      const rate = rateFromDose({ dose: d, unit: entry.unit, weight: weight, conc: conc });
      out.push({ dose: round(d, 4), rate: rate == null ? null : roundToPump(rate), level: checkLimits(entry, d) });
      d = (i === 0 && lo < step) ? step : d + step;
    }
    return out;
  }

  // 24-h totals of a running infusion.
  function dailyTotals(entry, conc, rate) {
    const r = pos(rate);
    if (r == null || !conc) return null;
    const perMl = concPerMl(conc, conc.unit);
    return { ml: r * 24, amount: perMl == null ? null : perMl * r * 24, unit: conc.unit };
  }

  // How to make the solution from the stock ampoule.
  function prepPlan(conc, amp) {
    if (!conc || !amp) return null;
    const need = convert(conc.amount, conc.unit, amp.unit);
    const per = pos(amp.amount), ampMl = pos(amp.ml), vol = pos(conc.ml);
    if (need == null || per == null || ampMl == null || vol == null) return null;
    const ampoules = need / per;
    const drawMl = ampoules * ampMl;
    const diluentMl = vol - drawMl;
    return {
      ampoules: round(ampoules, 2), open: Math.ceil(ampoules - 1e-9), drawMl: round(drawMl, 2),
      diluentMl: round(Math.max(0, diluentMl), 1), undiluted: Math.abs(diluentMl) < 0.05, impossible: diluentMl < -0.05,
    };
  }

  // Simulated pump: what has gone in after `elapsedH` hours at `rate` mL/h of a `volume` mL syringe/bag.
  function pumpState(o) {
    const rate = numv(o.rate) || 0, vol = pos(o.volume), h = Math.max(0, numv(o.elapsedH) || 0);
    if (vol == null) return null;
    const infused = Math.min(vol, rate * h);
    const left = vol - infused;
    const hoursLeft = rate > 0 ? left / rate : null;
    return { infused: infused, left: left, fraction: left / vol, hoursLeft: hoursLeft, empty: left <= 1e-9, nearEmpty: left / vol < 0.1 };
  }

  // Gravity drip: drops/min from volume, minutes and the giving-set drop factor.
  function dripRate(volumeMl, minutes, dropFactor) {
    const v = pos(volumeMl), m = pos(minutes), f = pos(dropFactor);
    if (v == null || m == null || f == null) return null;
    return { dropsPerMin: (v * f) / m, mlPerHour: (v / m) * 60 };
  }
  function dripsFromRate(mlPerHour, dropFactor) {
    const r = pos(mlPerHour), f = pos(dropFactor);
    return r == null || f == null ? null : (r * f) / 60;
  }

  /* ---- body size ---- */
  function ibw(heightCm, sex) {
    const h = pos(heightCm);
    if (h == null) return null;
    const v = (sex === 'F' ? 45.5 : 50) + 0.9055 * (h - 152.4);   // Devine: 2.3 kg per inch over 5 ft
    return v > 0 ? v : null;
  }
  function adjBw(weight, ibwKg) {
    const w = pos(weight), i = pos(ibwKg);
    if (w == null || i == null) return null;
    return w > i ? i + 0.4 * (w - i) : w;
  }
  function bmi(weight, heightCm) { const w = pos(weight), h = pos(heightCm); return w == null || h == null ? null : w / Math.pow(h / 100, 2); }
  function bsaMosteller(weight, heightCm) { const w = pos(weight), h = pos(heightCm); return w == null || h == null ? null : Math.sqrt((w * h) / 3600); }
  // APLS weight estimate from age in years (1–12).
  function weightFromAge(age) {
    const a = numv(age);
    if (a == null || a < 0) return null;
    if (a < 1) return round(Math.max(3.5, (a * 12 + 9) / 2), 1);   // (months + 9) / 2
    if (a <= 5) return 2 * a + 8;
    if (a <= 12) return 3 * a + 7;
    return null;
  }

  /* ---- renal ---- */
  const scrMgDl = (scr, unit) => { const s = pos(scr); return s == null ? null : (unit === 'umol' ? s / 88.4 : s); };
  function crclCockcroftGault(o) {
    const age = pos(o.age), w = pos(o.weight), s = scrMgDl(o.scr, o.scrUnit);
    if (age == null || w == null || s == null) return null;
    return ((140 - age) * w * (o.sex === 'F' ? 0.85 : 1)) / (72 * s);
  }
  // CKD-EPI 2021 (race-free), mL/min/1.73 m².
  function egfrCkdEpi2021(o) {
    const age = pos(o.age), s = scrMgDl(o.scr, o.scrUnit);
    if (age == null || s == null) return null;
    const F = o.sex === 'F', k = F ? 0.7 : 0.9, a = F ? -0.241 : -0.302;
    return 142 * Math.pow(Math.min(s / k, 1), a) * Math.pow(Math.max(s / k, 1), -1.2) * Math.pow(0.9938, age) * (F ? 1.012 : 1);
  }
  // Bedside Schwartz (children), mL/min/1.73 m².
  function schwartzBedside(heightCm, scr, scrUnit) { const h = pos(heightCm), s = scrMgDl(scr, scrUnit); return h == null || s == null ? null : (0.413 * h) / s; }

  /* ---- fluids ---- */
  // Holliday–Segar 4-2-1 (mL/h) and 100/50/20 (mL/day).
  function maintenance421(weight) {
    const w = pos(weight);
    if (w == null) return null;
    const perH = w <= 10 ? 4 * w : w <= 20 ? 40 + 2 * (w - 10) : 60 + (w - 20);
    const perDay = w <= 10 ? 100 * w : w <= 20 ? 1000 + 50 * (w - 10) : 1500 + 20 * (w - 20);
    return { mlPerHour: perH, mlPerDay: perDay };
  }
  // Parkland: 4 mL × kg × %TBSA in 24 h, half in the first 8 h from the time of the burn.
  function parkland(weight, tbsa) {
    const w = pos(weight), t = pos(tbsa);
    if (w == null || t == null) return null;
    const total = 4 * w * Math.min(100, t);
    return { total: total, first8: total / 2, first8PerHour: total / 16, next16PerHour: total / 32 };
  }

  /* ---- sodium & water ---- */
  // Total body water fraction: child 0.6, adult man 0.6, woman 0.5, elderly man 0.5, elderly woman 0.45.
  function tbwFraction(sex, age) {
    const a = numv(age);
    if (a != null && a < 18) return 0.6;
    const old = a != null && a >= 65;
    if (sex === 'F') return old ? 0.45 : 0.5;
    return old ? 0.5 : 0.6;
  }
  function tbw(weight, sex, age) { const w = pos(weight); return w == null ? null : w * tbwFraction(sex, age); }
  function sodiumDeficit(o) {
    const t = tbw(o.weight, o.sex, o.age), cur = pos(o.na), target = pos(o.target);
    return t == null || cur == null || target == null ? null : t * (target - cur);
  }
  const FLUID_NA = { 'NS 0.9%': 154, '3% saline': 513, "Ringer's lactate": 130, '0.45% saline': 77, 'DNS (D5 + 0.9%)': 154, 'D5W': 0 };
  // Adrogué–Madias: change in serum Na from 1 L of the infusate.
  function adrogueMadias(o) {
    const t = tbw(o.weight, o.sex, o.age), na = pos(o.na);
    const inNa = numv(o.infusateNa), inK = numv(o.infusateK) || 0;
    if (t == null || na == null || inNa == null) return null;
    const perL = (inNa + inK - na) / (t + 1);
    const target = numv(o.targetChange);
    return { perLitre: perL, litresForTarget: target != null && perL !== 0 ? Math.abs(target / perL) : null };
  }
  function freeWaterDeficit(o) {
    const t = tbw(o.weight, o.sex, o.age), na = pos(o.na);
    return t == null || na == null ? null : t * (na / 140 - 1);
  }
  // Hillier: + 2.4 mmol/L per 100 mg/dL glucose above 100.
  function correctedSodium(na, glucose, glucoseUnit) {
    const n = pos(na), g = pos(glucose);
    if (n == null || g == null) return null;
    const mg = glucoseUnit === 'mmol' ? g * 18 : g;
    return n + 0.024 * (mg - 100);
  }
  // Calcium corrected for albumin (mg/dL with g/dL albumin, or mmol/L with g/L).
  function correctedCalcium(ca, alb, unit) {
    const c = pos(ca), a = pos(alb);
    if (c == null || a == null) return null;
    return unit === 'mmol' ? c + 0.02 * (40 - a) : c + 0.8 * (4 - a);
  }
  function anionGap(na, cl, hco3, albGdl) {
    const n = pos(na), c = pos(cl), h = pos(hco3);
    if (n == null || c == null || h == null) return null;
    const ag = n - (c + h);
    const a = pos(albGdl);
    return { gap: ag, corrected: a == null ? null : ag + 2.5 * (4 - a) };
  }
  function meanArterial(sbp, dbp) { const s = pos(sbp), d = pos(dbp); return s == null || d == null ? null : (s + 2 * d) / 3; }

  /* ---- unit converter ---- */
  // kind: 'mass' (value, from, to) | 'ratio' (1:N → mg/mL) | 'percent' (% → mg/mL) | 'mmol' (mg ↔ mmol with mw & valence)
  function convertUnits(o) {
    const v = numv(o.value);
    if (v == null) return null;
    if (o.kind === 'ratio') return v > 0 ? 1000 / v : null;           // 1:1000 → 1 mg/mL
    if (o.kind === 'percent') return v * 10;                          // 1% → 10 mg/mL
    if (o.kind === 'mg2mmol') { const mw = pos(o.mw); return mw == null ? null : v / mw; }
    if (o.kind === 'mmol2meq') return v * (pos(o.valence) || 1);
    return convert(v, o.from, o.to);
  }

  /* ---- emergency sheet ---- */
  function isAdult(weight, age) {
    const a = numv(age), w = pos(weight);
    if (a != null) return a >= 16;
    return w != null && w >= 50;
  }
  function emergencyDose(entry, weight, age) {
    const w = pos(weight);
    if (!entry || w == null) return null;
    const adult = isAdult(weight, age);
    const range = Array.isArray(entry.dose) ? entry.dose : [entry.dose, entry.dose];
    let lo = range[0] * w, hi = range[1] * w, capped = false, usedAdult = false;
    if (adult && entry.adult != null && !Array.isArray(entry.dose)) { lo = hi = entry.adult; usedAdult = true; }
    if (entry.min != null && !usedAdult) { if (lo < entry.min) lo = entry.min; if (hi < entry.min) hi = entry.min; }
    // The adult dose IS the adult dose — the paediatric single-dose ceiling (atropine 0.5 mg) does not apply to it.
    if (entry.max != null && !usedAdult) { if (hi > entry.max) { hi = entry.max; capped = true; } if (lo > entry.max) { lo = entry.max; capped = true; } }
    const ml = entry.perMl ? [lo / entry.perMl, hi / entry.perMl] : (entry.unit === 'mL' ? [lo, hi] : null);
    return { lo: lo, hi: hi, unit: entry.unit, ml: ml, capped: capped, adult: usedAdult, single: Math.abs(hi - lo) < 1e-9 };
  }
  function electricalDose(entry, weight, age) {
    const w = pos(weight);
    if (!entry || w == null) return null;
    const r = Array.isArray(entry.jPerKg) ? entry.jPerKg : [entry.jPerKg, entry.jPerKg];
    if (isAdult(weight, age)) return { lo: entry.adult, hi: entry.adult, adult: true, capped: false };
    const cap = Math.min(entry.adult, entry.max ? entry.max * w : Infinity);
    const lo = Math.min(cap, r[0] * w), hi = Math.min(cap, r[1] * w);
    return { lo: lo, hi: hi, adult: false, capped: r[1] * w > cap };
  }
  // ETT: uncuffed age/4 + 4, cuffed age/4 + 3.5, oral depth age/2 + 12 (APLS), for 1–12 y.
  function airway(age) {
    const a = numv(age);
    if (a == null) return null;
    if (a < 1) return { cuffed: 3.5, uncuffed: 3.5, depth: null, note: 'Infant: 3.0–3.5 cuffed (term), 3.5–4.0 uncuffed.' };
    if (a > 12) return { cuffed: null, uncuffed: null, depth: null, note: 'Adult: women 7.0–7.5, men 7.5–8.5; oral depth ≈ 21 / 23 cm at the teeth.' };
    // Round DOWN to the half size (a smaller tube passes); have ±0.5 ready.
    const half = (x) => Math.floor(x * 2 + 1e-9) / 2;
    return { cuffed: half(a / 4 + 3.5), uncuffed: half(a / 4 + 4), depth: round(a / 2 + 12, 1), note: 'Have the half size above and below ready.' };
  }
  function emergencySheet(lib, weight, age) {
    const em = (lib && lib.EMERGENCY) || [], el = (lib && lib.ELECTRICAL) || [];
    return {
      drugs: em.map((e) => ({ entry: e, dose: emergencyDose(e, weight, age) })),
      electrical: el.map((e) => ({ entry: e, dose: electricalDose(e, weight, age) })),
      airway: airway(age),
      fluid: maintenance421(weight),
    };
  }

  /* ---- paediatric ---- */
  // mgPerKg: the chosen figure inside entry.dose ([lo, hi]); defaults to the top of the range.
  function paedDose(entry, weight, strength, mgPerKg) {
    const w = pos(weight);
    if (!entry || w == null) return null;
    const range = entry.dose || [];
    const pick = numv(mgPerKg) != null ? numv(mgPerKg) : range[1];
    const perDay = Math.max(1, entry.perDay || 1);
    let dose = entry.mode === 'day' ? (pick * w) / perDay : pick * w;
    let capped = null;
    if (entry.maxDose != null && dose > entry.maxDose) { dose = entry.maxDose; capped = 'dose'; }
    let day = dose * perDay;
    const dayCap = Math.min(entry.maxDay != null ? entry.maxDay : Infinity, entry.maxDayPerKg != null ? entry.maxDayPerKg * w : Infinity);
    if (day > dayCap + 1e-9) { day = dayCap; dose = dayCap / perDay; capped = 'day'; }
    let volume = null, units = null;
    if (strength && strength.form) units = dose / strength.mg;                   // tablets / capsules
    else if (strength && pos(strength.mg) && pos(strength.ml)) volume = (dose / strength.mg) * strength.ml;
    return { dose: dose, day: day, perDay: perDay, mgPerKg: pick, volume: volume, units: units, capped: capped, outOfRange: pick < range[0] - 1e-9 || pick > range[1] + 1e-9 };
  }

  /* ---- library merge, hashing, ordering ---- */
  // FNV-1a over a stable JSON of the clinical content (never ids, review or ordering).
  function stableJson(v) {
    if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
    return JSON.stringify(v == null ? null : v);
  }
  const META = { id: 1, kind: 1, review: 1, reviewed: 1, builtIn: 1, custom: 1, disabled: 1, updatedAt: 1, updatedBy: 1, overridden: 1 };
  function contentHash(entry) {
    const c = {};
    Object.keys(entry || {}).forEach((k) => { if (!META[k]) c[k] = entry[k]; });
    const s = stableJson(c);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  const KIND_LIST = { infusion: 'INFUSIONS', emergency: 'EMERGENCY', paed: 'PAEDIATRIC' };
  // overrides: [{ id, kind, builtIn, disabled, data, review:{by, at, hash} }]
  function mergeLibrary(lib, overrides) {
    const byId = {};
    (overrides || []).forEach((o) => { if (o && o.id && o.id.charAt(0) !== '_') byId[o.id] = o; });
    const out = {};
    Object.keys(KIND_LIST).forEach((kind) => {
      const list = ((lib && lib[KIND_LIST[kind]]) || []).map((b) => {
        const o = byId[b.id];
        const e = Object.assign({}, b, o && o.data ? o.data : {}, { id: b.id, kind: kind, builtIn: true, overridden: !!(o && o.data && Object.keys(o.data).length), disabled: !!(o && o.disabled) });
        return withReview(e, o);
      });
      Object.keys(byId).forEach((id) => {
        const o = byId[id];
        if (o.kind !== kind || o.builtIn || list.some((x) => x.id === id) || !o.data) return;
        list.push(withReview(Object.assign({}, o.data, { id: id, kind: kind, builtIn: false, custom: true, disabled: !!o.disabled }), o));
      });
      out[kind] = list;
    });
    return out;
  }
  function withReview(e, o) {
    const r = o && o.review;
    const hash = contentHash(e);
    e.reviewed = !r || !r.hash ? { state: 'none' } : { state: r.hash === hash ? 'ok' : 'stale', by: r.by, at: r.at };
    return e;
  }
  // Items in the saved order; anything new goes to the end (in its own order), unknown ids are ignored.
  function applyOrder(items, order, key) {
    const get = key || ((x) => x.id);
    if (!Array.isArray(order) || !order.length) return items.slice();
    const pos = {};
    order.forEach((id, i) => { if (pos[id] == null) pos[id] = i; });
    return items.map((x, i) => ({ x: x, i: i, p: pos[get(x)] })).sort((a, b) => {
      if (a.p != null && b.p != null) return a.p - b.p;
      if (a.p != null) return -1;
      if (b.p != null) return 1;
      return a.i - b.i;
    }).map((r) => r.x);
  }
  function moveItem(list, from, to) {
    const a = list.slice();
    if (from < 0 || from >= a.length || to < 0 || to >= a.length || from === to) return a;
    const it = a.splice(from, 1)[0];
    a.splice(to, 0, it);
    return a;
  }

  // Human formatting: 2.625 → "2.63", 1250 → "1,250", 0.0125 → "0.0125".
  function fmt(n, dp) {
    if (fin(n) == null) return '—';
    const a = Math.abs(n);
    const d = dp != null ? dp : a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
    // Trailing zeros are trimmed only AFTER a decimal point — "160" must never become "16".
    let s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.indexOf('.') < 0 && Math.abs(n) >= 1000 ? Number(s).toLocaleString('en-US') : s;
  }

  const API = {
    MASS: MASS, ACT: ACT, FLUID_NA: FLUID_NA, round: round, fmt: fmt, factor: factor, convert: convert, parseUnit: parseUnit,
    concPerMl: concPerMl, rateFromDose: rateFromDose, doseFromRate: doseFromRate, roundToPump: roundToPump, checkLimits: checkLimits,
    titrationTable: titrationTable, dailyTotals: dailyTotals, prepPlan: prepPlan, pumpState: pumpState, dripRate: dripRate, dripsFromRate: dripsFromRate,
    ibw: ibw, adjBw: adjBw, bmi: bmi, bsaMosteller: bsaMosteller, weightFromAge: weightFromAge,
    crclCockcroftGault: crclCockcroftGault, egfrCkdEpi2021: egfrCkdEpi2021, schwartzBedside: schwartzBedside,
    maintenance421: maintenance421, parkland: parkland, tbwFraction: tbwFraction, tbw: tbw, sodiumDeficit: sodiumDeficit,
    adrogueMadias: adrogueMadias, freeWaterDeficit: freeWaterDeficit, correctedSodium: correctedSodium, correctedCalcium: correctedCalcium,
    anionGap: anionGap, meanArterial: meanArterial, convertUnits: convertUnits,
    isAdult: isAdult, emergencyDose: emergencyDose, electricalDose: electricalDose, airway: airway, emergencySheet: emergencySheet,
    paedDose: paedDose, contentHash: contentHash, mergeLibrary: mergeLibrary, applyOrder: applyOrder, moveItem: moveItem,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.UNICO_DOSE = API;
})(typeof window !== 'undefined' ? window : null);

;
/* ===== dose-pumps.jsx ===== */
(function(){
(function () {
  const {
    useState,
    useEffect,
    useRef,
    useCallback
  } = React;
  const D = () => window.UNICO_DOSE;
  const reduceMotion = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  };
  const fmtH = h => {
    if (h == null || !Number.isFinite(h)) return '—';
    if (h > 99) return '> 99 h';
    const m = Math.round(h * 60);
    return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm';
  };
  const clockAt = h => {
    if (h == null || !Number.isFinite(h) || h > 72) return '';
    const d = new Date(Date.now() + h * 3600e3);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }) + (d.getDate() !== new Date().getDate() ? ' (tomorrow)' : '');
  };
  const f1 = n => n == null || !Number.isFinite(n) ? '—' : (Math.round(n * 10) / 10).toFixed(n < 10 ? 1 : n < 100 ? 1 : 0);
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }
  function usePumpSim({
    rate,
    volume,
    locked,
    bolusRate
  }) {
    const [run, setRun] = useState(false);
    const [infused, setInfused] = useState(0);
    const [speed, setSpeed] = useState(60);
    const [bolusLeft, setBolusLeft] = useState(0);
    const ref = useRef({
      rate,
      volume,
      speed,
      bolusLeft,
      infused: 0
    });
    ref.current.rate = rate;
    ref.current.volume = volume;
    ref.current.speed = speed;
    useEffect(() => {
      if (locked && run) setRun(false);
    }, [locked, run]);
    useEffect(() => {
      if (!run) return undefined;
      let raf = 0,
        timer = 0,
        last = performance.now(),
        alive = true;
      const slow = reduceMotion();
      const tick = now => {
        if (!alive) return;
        const dtH = Math.min(0.25, (now - last) / 3600e3) * ref.current.speed;
        last = now;
        if (!document.hidden) {
          const r = ref.current;
          let add = (Number(r.rate) || 0) * dtH;
          let bl = r.bolusLeft;
          if (bl > 0) {
            const b = Math.min(bl, (bolusRate || 300) * dtH);
            add += b;
            bl -= b;
            r.bolusLeft = bl;
            setBolusLeft(bl);
          }
          const next = Math.min(r.volume || 0, r.infused + add);
          r.infused = next;
          setInfused(next);
          if (next >= (r.volume || 0) - 1e-9) {
            setRun(false);
            return;
          }
        }
        if (slow) timer = setTimeout(() => tick(performance.now()), 1000);else raf = requestAnimationFrame(tick);
      };
      if (slow) timer = setTimeout(() => tick(performance.now()), 1000);else raf = requestAnimationFrame(tick);
      return () => {
        alive = false;
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }, [run, bolusRate]);
    const stop = useCallback(() => {
      setRun(false);
      ref.current.infused = 0;
      ref.current.bolusLeft = 0;
      setInfused(0);
      setBolusLeft(0);
    }, []);
    const bolus = useCallback(ml => {
      ref.current.bolusLeft += ml;
      setBolusLeft(ref.current.bolusLeft);
    }, []);
    const left = Math.max(0, (volume || 0) - infused);
    const hoursLeft = rate > 0 ? left / rate : null;
    return {
      run,
      setRun,
      infused,
      left,
      frac: volume ? left / volume : 0,
      hoursLeft,
      speed,
      setSpeed,
      stop,
      bolus,
      bolusing: bolusLeft > 0,
      empty: volume > 0 && left <= 1e-6,
      nearEmpty: volume > 0 && left / volume < 0.1
    };
  }
  function useAlarmBeep(on, alarm) {
    useEffect(() => {
      if (!on || !alarm) return undefined;
      beep();
      const t = setInterval(beep, 1300);
      return () => clearInterval(t);
    }, [on, alarm]);
  }
  function RateKnob({
    value,
    onChange,
    step,
    max,
    disabled,
    color
  }) {
    const drag = useRef(null);
    const v = Number(value) || 0;
    const angle = -135 + Math.min(1, v / (max || 100)) * 270;
    const set = n => {
      if (!disabled) onChange(Math.max(0, Math.round(n / step) * step));
    };
    return React.createElement("div", {
      role: "slider",
      tabIndex: disabled ? -1 : 0,
      "aria-label": "Pump rate (mL/h)",
      "aria-valuenow": v,
      "aria-valuemin": 0,
      "aria-valuemax": max,
      className: 'dc-knob' + (disabled ? ' is-off' : ''),
      onKeyDown: e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          set(v + step);
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          set(v - step);
        }
      },
      onWheel: e => {
        e.preventDefault();
        set(v + (e.deltaY < 0 ? step : -step));
      },
      onPointerDown: e => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
          y: e.clientY,
          v
        };
      },
      onPointerMove: e => {
        if (!drag.current) return;
        const dy = drag.current.y - e.clientY;
        set(drag.current.v + Math.round(dy / 4) * step);
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
      title: "Drag up/down, scroll, or use the arrow keys"
    }, React.createElement("svg", {
      viewBox: "0 0 64 64",
      width: "60",
      height: "60"
    }, React.createElement("defs", null, React.createElement("radialGradient", {
      id: "knobG",
      cx: "35%",
      cy: "30%",
      r: "75%"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#c9d3df"
    }))), React.createElement("circle", {
      cx: "32",
      cy: "32",
      r: "29",
      fill: "none",
      stroke: "rgba(125,145,180,.25)",
      strokeWidth: "3",
      strokeDasharray: "137 46",
      transform: "rotate(135 32 32)"
    }), React.createElement("circle", {
      cx: "32",
      cy: "32",
      r: "29",
      fill: "none",
      stroke: color || '#0090ca',
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeDasharray: Math.min(1, v / (max || 100)) * 137 + ' 999',
      transform: "rotate(135 32 32)",
      style: {
        transition: 'stroke-dasharray .2s'
      }
    }), React.createElement("circle", {
      cx: "32",
      cy: "32",
      r: "22",
      fill: "url(#knobG)",
      stroke: "rgba(31,59,90,.18)"
    }), [...Array(12)].map((_, i) => React.createElement("line", {
      key: i,
      x1: "32",
      y1: "12.5",
      x2: "32",
      y2: "15",
      stroke: "rgba(31,59,90,.25)",
      strokeWidth: "1.2",
      transform: 'rotate(' + i * 30 + ' 32 32)'
    })), React.createElement("g", {
      style: {
        transform: 'rotate(' + angle + 'deg)',
        transformOrigin: '32px 32px',
        transition: 'transform .18s cubic-bezier(.3,1.5,.5,1)'
      }
    }, React.createElement("line", {
      x1: "32",
      y1: "32",
      x2: "32",
      y2: "15",
      stroke: color || '#0090ca',
      strokeWidth: "3.2",
      strokeLinecap: "round"
    })), React.createElement("circle", {
      cx: "32",
      cy: "32",
      r: "3.2",
      fill: "#16202e"
    })));
  }
  function Controls({
    sim,
    rate,
    onRate,
    step,
    locked,
    beepOn,
    setBeep,
    onBolus,
    bolusMl,
    maxRate,
    color,
    kind
  }) {
    const r = Number(rate) || 0;
    const set = n => onRate(Math.max(0, D().roundToPump(n)));
    return React.createElement("div", {
      className: "dc-pump-ctl"
    }, React.createElement("div", {
      className: "dc-pump-btns"
    }, React.createElement("button", {
      className: 'dc-pbtn ' + (sim.run ? 'is-pause' : 'is-run'),
      disabled: locked || !(r > 0) || sim.empty,
      onClick: () => sim.setRun(!sim.run),
      title: locked ? 'Locked — the dose is over the hard limit' : ''
    }, sim.run ? React.createElement(React.Fragment, null, React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "13",
      height: "13"
    }, React.createElement("rect", {
      x: "6",
      y: "5",
      width: "4",
      height: "14",
      rx: "1",
      fill: "currentColor"
    }), React.createElement("rect", {
      x: "14",
      y: "5",
      width: "4",
      height: "14",
      rx: "1",
      fill: "currentColor"
    })), " Pause") : React.createElement(React.Fragment, null, React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "13",
      height: "13"
    }, React.createElement("path", {
      d: "M7 5l12 7-12 7z",
      fill: "currentColor"
    })), " ", sim.infused > 0 ? 'Resume' : 'Start')), React.createElement("button", {
      className: "dc-pbtn",
      onClick: sim.stop,
      title: "Stop and reset the volume counter"
    }, React.createElement("svg", {
      viewBox: "0 0 24 24",
      width: "12",
      height: "12"
    }, React.createElement("rect", {
      x: "6",
      y: "6",
      width: "12",
      height: "12",
      rx: "1.5",
      fill: "currentColor"
    })), " Stop"), kind === 'syringe' && bolusMl ? React.createElement("button", {
      className: "dc-pbtn",
      disabled: !sim.run || locked,
      onClick: () => onBolus && onBolus(),
      title: 'Give a ' + bolusMl + ' mL bolus (simulated)'
    }, "Bolus ", bolusMl, " mL") : null), React.createElement("div", {
      className: "dc-pump-rate"
    }, React.createElement("button", {
      className: "dc-step",
      "aria-label": "Lower rate",
      onClick: () => set(r - step)
    }, "\u25BC"), React.createElement(RateKnob, {
      value: r,
      onChange: set,
      step: step,
      max: maxRate,
      color: color
    }), React.createElement("button", {
      className: "dc-step",
      "aria-label": "Raise rate",
      onClick: () => set(r + step)
    }, "\u25B2")), React.createElement("div", {
      className: "dc-pump-opts"
    }, React.createElement("label", {
      title: "Speed up the simulation only \u2014 the rate shown is real"
    }, React.createElement("span", null, "Time-lapse"), React.createElement("select", {
      value: sim.speed,
      onChange: e => sim.setSpeed(Number(e.target.value))
    }, React.createElement("option", {
      value: 1
    }, "\xD71 real time"), React.createElement("option", {
      value: 60
    }, "\xD760 (1 min = 1 h)"), React.createElement("option", {
      value: 600
    }, "\xD7600"))), React.createElement("label", {
      className: "dc-check"
    }, React.createElement("input", {
      type: "checkbox",
      checked: beepOn,
      onChange: e => setBeep(e.target.checked)
    }), " Alarm sound")));
  }
  const LEVEL_TEXT = {
    hard: 'OVER HARD LIMIT',
    high: 'HIGH DOSE',
    low: 'LOW DOSE'
  };
  function alarmOf(level, sim, emptyText) {
    if (level === 'hard') return {
      text: LEVEL_TEXT.hard + ' — LOCKED',
      tone: 'red'
    };
    if (sim.empty) return {
      text: emptyText,
      tone: 'red'
    };
    if (sim.nearEmpty && sim.infused > 0) return {
      text: 'NEAR EMPTY',
      tone: 'amber'
    };
    if (level === 'high' || level === 'low') return {
      text: LEVEL_TEXT[level],
      tone: 'amber'
    };
    return null;
  }
  const LCD = {
    ok: '#6ff2d2',
    amber: '#ffc861',
    red: '#ff7b8c'
  };
  function SyringePump({
    drug,
    color,
    rate,
    volume,
    doseText,
    level,
    onRate,
    step,
    bolusMl,
    maxRate
  }) {
    const vol = Number(volume) > 0 ? Number(volume) : 50;
    const locked = level === 'hard';
    const sim = usePumpSim({
      rate: Number(rate) || 0,
      volume: vol,
      locked,
      bolusRate: 600
    });
    const [beepOn, setBeep] = useState(false);
    const alarm = alarmOf(level, sim, 'SYRINGE EMPTY');
    useAlarmBeep(beepOn, alarm && (sim.run || locked || sim.empty) ? alarm.text : null);
    const tone = alarm ? LCD[alarm.tone] : LCD.ok;
    const X0 = 176,
      X1 = 428,
      travel = X1 - X0;
    const head = X0 + (1 - sim.frac) * travel;
    const flowDur = sim.run ? Math.max(0.25, 2.6 / Math.log2(2 + (Number(rate) || 0) * sim.speed / 6)) : 0;
    const liquid = color || '#27a8db';
    const ticks = [];
    for (let i = 0; i <= 10; i++) ticks.push(i);
    return React.createElement("div", {
      className: 'dc-pump' + (alarm ? ' is-alarm-' + alarm.tone : '') + (sim.run ? ' is-running' : '')
    }, React.createElement("svg", {
      viewBox: "0 0 560 236",
      className: "dc-pump-svg",
      role: "img",
      "aria-label": 'Syringe pump at ' + f1(rate) + ' mL per hour'
    }, React.createElement("defs", null, React.createElement("linearGradient", {
      id: "spBody",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#dfe6ee"
    })), React.createElement("linearGradient", {
      id: "spRail",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#eef2f7"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#c7d1dc"
    })), React.createElement("linearGradient", {
      id: "spGlass",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "rgba(255,255,255,.95)"
    }), React.createElement("stop", {
      offset: ".5",
      stopColor: "rgba(225,238,248,.55)"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "rgba(190,210,228,.7)"
    })), React.createElement("linearGradient", {
      id: "spLiquid",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: liquid,
      stopOpacity: ".55"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: liquid,
      stopOpacity: ".9"
    })), React.createElement("linearGradient", {
      id: "spLcd",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#0d2633"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#06141c"
    })), React.createElement("filter", {
      id: "spShadow",
      x: "-10%",
      y: "-10%",
      width: "120%",
      height: "140%"
    }, React.createElement("feDropShadow", {
      dx: "0",
      dy: "6",
      stdDeviation: "7",
      floodColor: "#1f3b5a",
      floodOpacity: ".18"
    })), React.createElement("filter", {
      id: "spGlow"
    }, React.createElement("feGaussianBlur", {
      stdDeviation: "1.4",
      result: "b"
    }), React.createElement("feMerge", null, React.createElement("feMergeNode", {
      in: "b"
    }), React.createElement("feMergeNode", {
      in: "SourceGraphic"
    })))), React.createElement("rect", {
      x: "10",
      y: "70",
      width: "540",
      height: "152",
      rx: "20",
      fill: "url(#spBody)",
      stroke: "rgba(31,59,90,.14)",
      filter: "url(#spShadow)"
    }), React.createElement("rect", {
      x: "22",
      y: "58",
      width: "516",
      height: "22",
      rx: "9",
      fill: "url(#spRail)",
      stroke: "rgba(31,59,90,.12)"
    }), React.createElement("rect", {
      x: "420",
      y: "14",
      width: "26",
      height: "52",
      rx: "5",
      fill: "#cfd8e3",
      stroke: "rgba(31,59,90,.2)"
    }), React.createElement("rect", {
      x: X0 - 4,
      y: "22",
      width: travel + 8,
      height: "36",
      rx: "6",
      fill: "url(#spGlass)",
      stroke: "rgba(31,59,90,.35)",
      strokeWidth: "1.2"
    }), React.createElement("rect", {
      x: head,
      y: "25",
      width: Math.max(0, X1 - head),
      height: "30",
      rx: "3",
      fill: "url(#spLiquid)"
    }), ticks.map(i => {
      const x = X0 + i / 10 * travel;
      return React.createElement("g", {
        key: i
      }, React.createElement("line", {
        x1: x,
        y1: "22",
        x2: x,
        y2: i % 2 ? 29 : 33,
        stroke: "rgba(31,59,90,.45)",
        strokeWidth: "1"
      }), i % 2 === 0 ? React.createElement("text", {
        x: x,
        y: "42",
        fontSize: "7.5",
        textAnchor: "middle",
        fill: "rgba(31,59,90,.55)",
        fontFamily: "IBM Plex Mono,monospace"
      }, Math.round(vol - i / 10 * vol)) : null);
    }), React.createElement("rect", {
      x: X0 - 10,
      y: "16",
      width: "6",
      height: "48",
      rx: "2",
      fill: "#b9c4d1"
    }), React.createElement("rect", {
      x: head - 6,
      y: "24",
      width: "7",
      height: "32",
      rx: "2",
      fill: "#2d3a4a"
    }), React.createElement("rect", {
      x: head - 118,
      y: "36",
      width: "112",
      height: "8",
      rx: "2",
      fill: "#d7dee7",
      stroke: "rgba(31,59,90,.25)"
    }), React.createElement("g", null, React.createElement("rect", {
      x: head - 150,
      y: "10",
      width: "34",
      height: "62",
      rx: "7",
      fill: "#7f8fa3"
    }), React.createElement("rect", {
      x: head - 146,
      y: "14",
      width: "26",
      height: "54",
      rx: "5",
      fill: "#93a3b7"
    }), React.createElement("circle", {
      cx: head - 133,
      cy: "41",
      r: "5",
      fill: "#5b6b80"
    })), React.createElement("rect", {
      x: X1 + 4,
      y: "35",
      width: "18",
      height: "10",
      rx: "2",
      fill: "#d4dde7",
      stroke: "rgba(31,59,90,.3)"
    }), React.createElement("path", {
      d: 'M ' + (X1 + 22) + ' 40 C 500 40, 520 40, 528 60 S 548 96, 556 96',
      fill: "none",
      stroke: "rgba(31,59,90,.25)",
      strokeWidth: "5",
      strokeLinecap: "round"
    }), React.createElement("path", {
      d: 'M ' + (X1 + 22) + ' 40 C 500 40, 520 40, 528 60 S 548 96, 556 96',
      fill: "none",
      stroke: liquid,
      strokeWidth: "2.6",
      strokeLinecap: "round",
      strokeDasharray: "7 5",
      className: sim.run ? 'dc-flow' : '',
      style: sim.run ? {
        animationDuration: flowDur + 's'
      } : {
        opacity: .45
      }
    }), React.createElement("text", {
      x: "30",
      y: "106",
      fontSize: "14",
      fontWeight: "800",
      fill: "#16202e",
      letterSpacing: "1"
    }, "UNICO"), React.createElement("text", {
      x: "30",
      y: "121",
      fontSize: "9.5",
      fill: "#6c7a8c",
      letterSpacing: "1.2"
    }, "SYRINGE PUMP \xB7 SP-50"), React.createElement("g", {
      transform: "translate(30 138)"
    }, React.createElement("circle", {
      cx: "6",
      cy: "6",
      r: "5",
      fill: sim.run && !alarm ? '#25c06b' : '#9fd8b8',
      className: sim.run && !alarm ? 'dc-blink' : ''
    }), React.createElement("text", {
      x: "16",
      y: "9",
      fontSize: "10",
      fill: "#6c7a8c"
    }, "RUN"), React.createElement("circle", {
      cx: "60",
      cy: "6",
      r: "5",
      fill: alarm ? alarm.tone === 'red' ? '#ff4d64' : '#ffb020' : '#f0d9a8',
      className: alarm ? 'dc-blink-fast' : ''
    }), React.createElement("text", {
      x: "70",
      y: "9",
      fontSize: "10",
      fill: "#6c7a8c"
    }, "ALARM"), React.createElement("circle", {
      cx: "130",
      cy: "6",
      r: "5",
      fill: sim.bolusing ? '#3aa0ff' : '#bcd3ea'
    }), React.createElement("text", {
      x: "140",
      y: "9",
      fontSize: "10",
      fill: "#6c7a8c"
    }, "BOLUS")), React.createElement("text", {
      x: "30",
      y: "178",
      fontSize: "10.5",
      fill: "#6c7a8c"
    }, "Syringe"), React.createElement("text", {
      x: "30",
      y: "195",
      fontSize: "14",
      fontWeight: "700",
      fill: "#16202e",
      fontFamily: "IBM Plex Mono,monospace"
    }, f1(vol), " mL"), React.createElement("text", {
      x: "130",
      y: "178",
      fontSize: "10.5",
      fill: "#6c7a8c"
    }, "Speed"), React.createElement("text", {
      x: "130",
      y: "195",
      fontSize: "14",
      fontWeight: "700",
      fill: "#16202e",
      fontFamily: "IBM Plex Mono,monospace"
    }, "\xD7", sim.speed), React.createElement("rect", {
      x: "246",
      y: "88",
      width: "290",
      height: "122",
      rx: "12",
      fill: "url(#spLcd)",
      stroke: "#031018",
      strokeWidth: "2"
    }), React.createElement("g", {
      filter: "url(#spGlow)",
      fontFamily: "IBM Plex Mono,monospace"
    }, React.createElement("text", {
      x: "260",
      y: "108",
      fontSize: "12.5",
      fill: tone,
      opacity: ".85"
    }, String(drug || 'No drug selected').slice(0, 32)), React.createElement("text", {
      x: "260",
      y: "146",
      fontSize: "36",
      fontWeight: "700",
      fill: tone
    }, f1(rate), React.createElement("tspan", {
      fontSize: "15",
      dx: "6"
    }, "mL/h")), React.createElement("text", {
      x: "260",
      y: "167",
      fontSize: "13",
      fill: tone,
      opacity: ".9"
    }, doseText || ''), React.createElement("text", {
      x: "260",
      y: "186",
      fontSize: "11.5",
      fill: tone,
      opacity: ".78"
    }, "VOL ", f1(sim.infused), "/", f1(vol), " mL  LEFT ", fmtH(sim.hoursLeft)), React.createElement("text", {
      x: "260",
      y: "202",
      fontSize: "11.5",
      fontWeight: "700",
      fill: alarm ? LCD[alarm.tone] : tone,
      className: alarm ? 'dc-blink-fast' : ''
    }, alarm ? '⚠ ' + alarm.text : sim.run ? sim.bolusing ? '▶ BOLUS' : '▶ INFUSING' : sim.infused > 0 ? '❚❚ PAUSED' : '■ READY'))), React.createElement("div", {
      className: "dc-pump-foot"
    }, React.createElement("span", null, "Syringe empties at ", React.createElement("b", null, clockAt(sim.hoursLeft) || '—'), " ", React.createElement("i", null, "(", fmtH(sim.hoursLeft), " at this rate)"))), React.createElement(Controls, {
      sim: sim,
      rate: rate,
      onRate: onRate,
      step: step || 0.1,
      locked: locked,
      beepOn: beepOn,
      setBeep: setBeep,
      onBolus: () => sim.bolus(bolusMl),
      bolusMl: bolusMl,
      maxRate: maxRate,
      color: liquid,
      kind: "syringe"
    }));
  }
  function InfusionPump({
    fluid,
    color,
    rate,
    volume,
    dropFactor,
    doseText,
    level,
    onRate,
    step,
    maxRate
  }) {
    const vol = Number(volume) > 0 ? Number(volume) : 500;
    const locked = level === 'hard';
    const sim = usePumpSim({
      rate: Number(rate) || 0,
      volume: vol,
      locked
    });
    const [beepOn, setBeep] = useState(false);
    const alarm = alarmOf(level, sim, 'INFUSION COMPLETE');
    useAlarmBeep(beepOn, alarm && (sim.run || locked || sim.empty) ? alarm.text : null);
    const tone = alarm ? LCD[alarm.tone] : LCD.ok;
    const liquid = color || '#7cc6ec';
    const df = Number(dropFactor) || 20;
    const dpm = D().dripsFromRate(Number(rate) || 0, df) || 0;
    const dropDur = dpm > 0 ? Math.max(0.18, 60 / (dpm * Math.min(sim.speed, 30))) : 0;
    const rollDur = (Number(rate) || 0) > 0 ? Math.max(0.35, 30 / Math.sqrt((Number(rate) || 1) * Math.min(sim.speed, 60))) : 0;
    const fillTop = 26 + (1 - sim.frac) * 84;
    return React.createElement("div", {
      className: 'dc-pump' + (alarm ? ' is-alarm-' + alarm.tone : '') + (sim.run ? ' is-running' : '')
    }, React.createElement("svg", {
      viewBox: "0 0 560 292",
      className: "dc-pump-svg",
      role: "img",
      "aria-label": 'Infusion pump at ' + f1(rate) + ' mL per hour'
    }, React.createElement("defs", null, React.createElement("linearGradient", {
      id: "ipBody",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#dde5ee"
    })), React.createElement("linearGradient", {
      id: "ipLcd",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "#0d2633"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "#06141c"
    })), React.createElement("linearGradient", {
      id: "ipBag",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, React.createElement("stop", {
      offset: "0",
      stopColor: "rgba(255,255,255,.9)"
    }), React.createElement("stop", {
      offset: ".6",
      stopColor: "rgba(226,238,248,.55)"
    }), React.createElement("stop", {
      offset: "1",
      stopColor: "rgba(196,214,230,.7)"
    })), React.createElement("clipPath", {
      id: "ipBagClip"
    }, React.createElement("path", {
      d: "M48 22 Q48 14 56 14 L132 14 Q140 14 140 22 L140 104 Q140 118 126 122 L62 122 Q48 118 48 104 Z"
    })), React.createElement("filter", {
      id: "ipShadow",
      x: "-10%",
      y: "-10%",
      width: "120%",
      height: "140%"
    }, React.createElement("feDropShadow", {
      dx: "0",
      dy: "6",
      stdDeviation: "7",
      floodColor: "#1f3b5a",
      floodOpacity: ".18"
    })), React.createElement("filter", {
      id: "ipGlow"
    }, React.createElement("feGaussianBlur", {
      stdDeviation: "1.4",
      result: "b"
    }), React.createElement("feMerge", null, React.createElement("feMergeNode", {
      in: "b"
    }), React.createElement("feMergeNode", {
      in: "SourceGraphic"
    })))), React.createElement("line", {
      x1: "94",
      y1: "0",
      x2: "94",
      y2: "12",
      stroke: "#9aa6b4",
      strokeWidth: "3"
    }), React.createElement("path", {
      d: "M48 22 Q48 14 56 14 L132 14 Q140 14 140 22 L140 104 Q140 118 126 122 L62 122 Q48 118 48 104 Z",
      fill: "url(#ipBag)",
      stroke: "rgba(31,59,90,.35)",
      strokeWidth: "1.2"
    }), React.createElement("g", {
      clipPath: "url(#ipBagClip)"
    }, React.createElement("rect", {
      x: "44",
      y: fillTop,
      width: "100",
      height: 130 - fillTop,
      fill: liquid,
      opacity: ".55",
      style: {
        transition: 'y .3s linear'
      }
    }), React.createElement("path", {
      d: 'M44 ' + fillTop + ' q 12 -3 25 0 t 25 0 t 25 0 t 25 0',
      fill: "none",
      stroke: liquid,
      strokeWidth: "1.5",
      className: sim.run ? 'dc-wave' : ''
    })), React.createElement("text", {
      x: "94",
      y: "58",
      fontSize: "10",
      textAnchor: "middle",
      fontWeight: "700",
      fill: "#16202e"
    }, String(fluid || 'IV fluid').slice(0, 16)), React.createElement("text", {
      x: "94",
      y: "72",
      fontSize: "9",
      textAnchor: "middle",
      fill: "#3c4858",
      fontFamily: "IBM Plex Mono,monospace"
    }, f1(sim.left), " mL"), React.createElement("rect", {
      x: "88",
      y: "122",
      width: "12",
      height: "10",
      fill: "#cfd8e3"
    }), React.createElement("rect", {
      x: "80",
      y: "132",
      width: "28",
      height: "50",
      rx: "7",
      fill: "rgba(235,244,252,.75)",
      stroke: "rgba(31,59,90,.35)"
    }), React.createElement("rect", {
      x: "82",
      y: "166",
      width: "24",
      height: "14",
      rx: "4",
      fill: liquid,
      opacity: ".5"
    }), sim.run && dropDur ? React.createElement("circle", {
      cx: "94",
      cy: "138",
      r: "3.2",
      fill: liquid,
      className: "dc-drop",
      style: {
        animationDuration: dropDur + 's'
      }
    }) : React.createElement("circle", {
      cx: "94",
      cy: "138",
      r: "3",
      fill: liquid,
      opacity: ".6"
    }), React.createElement("path", {
      d: "M94 182 L94 214 Q94 232 112 232 L196 232",
      fill: "none",
      stroke: "rgba(31,59,90,.25)",
      strokeWidth: "5",
      strokeLinecap: "round"
    }), React.createElement("path", {
      d: "M94 182 L94 214 Q94 232 112 232 L196 232",
      fill: "none",
      stroke: liquid,
      strokeWidth: "2.4",
      strokeDasharray: "7 5",
      className: sim.run ? 'dc-flow' : '',
      style: sim.run ? {
        animationDuration: Math.max(0.3, rollDur / 2) + 's'
      } : {
        opacity: .45
      }
    }), React.createElement("rect", {
      x: "176",
      y: "34",
      width: "374",
      height: "246",
      rx: "22",
      fill: "url(#ipBody)",
      stroke: "rgba(31,59,90,.14)",
      filter: "url(#ipShadow)"
    }), React.createElement("rect", {
      x: "196",
      y: "56",
      width: "70",
      height: "204",
      rx: "12",
      fill: "#eef2f7",
      stroke: "rgba(31,59,90,.15)"
    }), React.createElement("path", {
      d: "M231 60 L231 256",
      stroke: "rgba(31,59,90,.25)",
      strokeWidth: "5"
    }), React.createElement("path", {
      d: "M231 60 L231 256",
      stroke: liquid,
      strokeWidth: "2.4",
      strokeDasharray: "7 5",
      className: sim.run ? 'dc-flow' : '',
      style: sim.run ? {
        animationDuration: Math.max(0.3, rollDur / 2) + 's'
      } : {
        opacity: .45
      }
    }), React.createElement("g", {
      className: sim.run && rollDur ? 'dc-spin' : '',
      style: sim.run && rollDur ? {
        animationDuration: rollDur + 's',
        transformOrigin: '231px 158px'
      } : {
        transformOrigin: '231px 158px'
      }
    }, React.createElement("circle", {
      cx: "231",
      cy: "158",
      r: "26",
      fill: "#d6dee8",
      stroke: "rgba(31,59,90,.25)"
    }), [0, 90, 180, 270].map(a => React.createElement("circle", {
      key: a,
      cx: 231 + 18 * Math.cos(a * Math.PI / 180),
      cy: 158 + 18 * Math.sin(a * Math.PI / 180),
      r: "6.5",
      fill: "#8b9bb0",
      stroke: "#6c7a8c"
    })), React.createElement("circle", {
      cx: "231",
      cy: "158",
      r: "5",
      fill: "#5b6b80"
    })), React.createElement("text", {
      x: "231",
      y: "250",
      fontSize: "7.5",
      textAnchor: "middle",
      fill: "#6c7a8c"
    }, "\u25BC TO PATIENT"), React.createElement("text", {
      x: "286",
      y: "68",
      fontSize: "14",
      fontWeight: "800",
      fill: "#16202e",
      letterSpacing: "1"
    }, "UNICO"), React.createElement("text", {
      x: "286",
      y: "82",
      fontSize: "9.5",
      fill: "#6c7a8c",
      letterSpacing: "1.4"
    }, "VOLUMETRIC PUMP \xB7 VP-1"), React.createElement("rect", {
      x: "286",
      y: "90",
      width: "248",
      height: "122",
      rx: "12",
      fill: "url(#ipLcd)",
      stroke: "#031018",
      strokeWidth: "2"
    }), React.createElement("g", {
      filter: "url(#ipGlow)",
      fontFamily: "IBM Plex Mono,monospace"
    }, React.createElement("text", {
      x: "300",
      y: "130",
      fontSize: "34",
      fontWeight: "700",
      fill: tone
    }, f1(rate), React.createElement("tspan", {
      fontSize: "15",
      dx: "6"
    }, "mL/h")), React.createElement("text", {
      x: "300",
      y: "150",
      fontSize: "12.5",
      fill: tone,
      opacity: ".9"
    }, doseText || f1(dpm) + ' drops/min  (' + df + ' gtt/mL)'), React.createElement("text", {
      x: "300",
      y: "169",
      fontSize: "11",
      fill: tone,
      opacity: ".78"
    }, "VTBI ", f1(vol), "  INFUSED ", f1(sim.infused), " mL"), React.createElement("text", {
      x: "300",
      y: "184",
      fontSize: "11",
      fill: tone,
      opacity: ".78"
    }, "TIME LEFT ", fmtH(sim.hoursLeft)), React.createElement("text", {
      x: "300",
      y: "203",
      fontSize: "11",
      fontWeight: "700",
      fill: alarm ? LCD[alarm.tone] : tone,
      className: alarm ? 'dc-blink-fast' : ''
    }, alarm ? '⚠ ' + alarm.text : sim.run ? '▶ INFUSING' : sim.infused > 0 ? '❚❚ PAUSED' : '■ READY')), React.createElement("g", {
      transform: "translate(300 230)"
    }, React.createElement("circle", {
      cx: "6",
      cy: "6",
      r: "5",
      fill: sim.run && !alarm ? '#25c06b' : '#9fd8b8',
      className: sim.run && !alarm ? 'dc-blink' : ''
    }), React.createElement("text", {
      x: "16",
      y: "9",
      fontSize: "10",
      fill: "#6c7a8c"
    }, "RUN"), React.createElement("circle", {
      cx: "62",
      cy: "6",
      r: "5",
      fill: alarm ? alarm.tone === 'red' ? '#ff4d64' : '#ffb020' : '#f0d9a8',
      className: alarm ? 'dc-blink-fast' : ''
    }), React.createElement("text", {
      x: "72",
      y: "9",
      fontSize: "10",
      fill: "#6c7a8c"
    }, "ALARM"), React.createElement("text", {
      x: "130",
      y: "9",
      fontSize: "8.5",
      fill: "#6c7a8c"
    }, f1(dpm), " gtt/min"))), React.createElement("div", {
      className: "dc-pump-foot"
    }, React.createElement("span", null, "Bag finishes at ", React.createElement("b", null, clockAt(sim.hoursLeft) || '—'), " ", React.createElement("i", null, "(", fmtH(sim.hoursLeft), " at this rate)"))), React.createElement(Controls, {
      sim: sim,
      rate: rate,
      onRate: onRate,
      step: step || 1,
      locked: locked,
      beepOn: beepOn,
      setBeep: setBeep,
      maxRate: maxRate,
      color: liquid,
      kind: "volumetric"
    }));
  }
  window.DosePumps = {
    SyringePump,
    InfusionPump,
    RateKnob
  };
})();
})();
;
/* ===== dose-calc.jsx ===== */
(function(){
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
(function () {
  const {
    useState,
    useEffect,
    useMemo,
    useRef,
    useLayoutEffect,
    useCallback
  } = React;
  const MK = window.MK;
  const D = window.UNICO_DOSE;
  const LIB = window.UNICO_DOSE_LIB;
  const fmt = (n, dp) => D.fmt(n, dp);
  const api = {
    get: u => fetch(u, {
      headers: {
        accept: 'application/json'
      }
    }).then(r => r.json()),
    send: (m, u, b) => fetch(u, {
      method: m,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(b || {})
    }).then(r => r.json())
  };
  const toast = (m, t) => {
    try {
      window.UI && window.UI.toast && window.UI.toast(m, t || 'success');
    } catch (e) {}
  };
  const isAdmin = () => {
    try {
      const u = window.__UNICO_USER__;
      return !u || u.role === 'Administrator';
    } catch (e) {
      return true;
    }
  };
  const userName = () => {
    try {
      const u = window.__UNICO_USER__;
      return u && (u.name || u.username) || '';
    } catch (e) {
      return '';
    }
  };
  const reduceMotion = () => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  };
  const escH = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  })[c]);
  const PREFS_KEY = 'dosecalc_prefs_v1',
    PATIENT_KEY = 'dosecalc_patient_v1';
  const readJson = (store, k, d) => {
    try {
      const v = JSON.parse(store.getItem(k) || 'null');
      return v && typeof v === 'object' ? v : d;
    } catch (e) {
      return d;
    }
  };
  const writeJson = (store, k, v) => {
    try {
      store.setItem(k, JSON.stringify(v));
    } catch (e) {}
  };
  const TABS = [{
    id: 'infusion',
    label: 'ICU infusions',
    icon: 'M7 3h10M9 3v4l-4 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-4-9V3'
  }, {
    id: 'emergency',
    label: 'Emergency sheet',
    icon: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9zM8 12h2l1-2 2 4 1-2h2'
  }, {
    id: 'paed',
    label: 'Paediatric',
    icon: 'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 22v-7l-2-4 6-2 6 2-2 4v7'
  }, {
    id: 'calcs',
    label: 'Clinical calculators',
    icon: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2M16 11v4'
  }];
  const GROUP_COLOR = {
    'Vasopressors & inotropes': '#e5484d',
    'Vasodilators & antiarrhythmics': '#f08c2e',
    'Sedation & analgesia': '#7c5cff',
    'Neuromuscular blockers': '#e0479e',
    'Insulin, heparin & others': '#d39b00',
    'Cardiac arrest': '#e5484d',
    'Anaphylaxis & shock': '#f08c2e',
    'Intubation (RSI)': '#7c5cff',
    'Seizure': '#0090ca',
    'Analgesic / antipyretic': '#0090ca',
    'Antibiotics (oral)': '#1f9d57',
    'Antibiotics (IV)': '#2b8f83',
    'Other': '#6a52d4'
  };
  const colorOf = g => GROUP_COLOR[g] || '#27a8db';
  const BOLUS_GROUPS = {
    'Sedation & analgesia': 1
  };
  const UNIT_CHOICES = ['mcg/kg/min', 'mcg/kg/h', 'mg/kg/h', 'mcg/min', 'mcg/h', 'mg/min', 'mg/h', 'g/h', 'units/kg/h', 'units/h', 'units/min', 'milliunits/min', 'mmol/h'];
  const AMOUNT_UNITS = ['mg', 'mcg', 'g', 'units', 'mmol'];
  const Svg = ({
    d,
    s,
    sw
  }) => React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: s || 15,
    height: s || 15,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: sw || 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: d
  }));
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
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    flask: 'M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-2.5L14 9V3',
    reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
    save: 'M5 3h11l3 3v15H5zM8 3v5h8M8 21v-7h8v7'
  };
  function useTween(target, ms) {
    const [v, setV] = useState(target);
    const from = useRef(target);
    useEffect(() => {
      if (target == null || !Number.isFinite(target)) {
        setV(target);
        from.current = target;
        return undefined;
      }
      if (reduceMotion() || from.current == null || !Number.isFinite(from.current)) {
        setV(target);
        from.current = target;
        return undefined;
      }
      const a = from.current,
        t0 = performance.now(),
        dur = ms || 380;
      let raf = 0;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur),
          e = 1 - Math.pow(1 - k, 3);
        const x = a + (target - a) * e;
        setV(x);
        from.current = x;
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    }, [target]);
    return v;
  }
  const Tween = ({
    value,
    dp
  }) => {
    const v = useTween(value);
    return React.createElement(React.Fragment, null, fmt(v == null ? null : v, dp));
  };
  function ReviewChip({
    e,
    compact
  }) {
    const r = e && e.reviewed || {
      state: 'none'
    };
    const when = r.at ? new Date(r.at).toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : '';
    if (r.state === 'ok') return React.createElement("span", {
      className: "dc-chip is-green",
      title: 'Reviewed by ' + (r.by || '?') + ' on ' + when
    }, React.createElement(Svg, {
      d: IC.shield,
      s: 11
    }), compact ? 'Reviewed' : 'Reviewed by ' + (r.by || '?') + ' · ' + when);
    if (r.state === 'stale') return React.createElement("span", {
      className: "dc-chip is-red",
      title: 'Edited after ' + (r.by || '?') + ' reviewed it on ' + when
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 11
    }), "Changed since review");
    return React.createElement("span", {
      className: "dc-chip is-amber",
      title: "Built-in default from published references \u2014 not yet checked against this hospital's protocol"
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 11
    }), compact ? 'Not reviewed' : 'Not yet reviewed by pharmacy');
  }
  const HighAlert = () => React.createElement("span", {
    className: "dc-chip is-red-solid",
    title: "ISMP high-alert medication \u2014 independent two-person check"
  }, "HIGH-ALERT");
  function Field({
    label,
    children,
    hint,
    wide
  }) {
    return React.createElement("label", {
      className: 'dc-field' + (wide ? ' is-wide' : '')
    }, React.createElement("span", {
      className: "dc-flabel"
    }, label), children, hint ? React.createElement("span", {
      className: "dc-fhint"
    }, hint) : null);
  }
  const NumIn = ({
    value,
    onChange,
    placeholder,
    step,
    min,
    style,
    autoFocus,
    ariaLabel
  }) => React.createElement("input", {
    className: "inp dc-num",
    inputMode: "decimal",
    type: "number",
    step: step || 'any',
    min: min != null ? min : 0,
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value),
    style: style,
    autoFocus: autoFocus,
    "aria-label": ariaLabel
  });
  function Seg({
    value,
    options,
    onChange,
    small
  }) {
    return React.createElement("div", {
      className: 'dc-seg' + (small ? ' is-small' : ''),
      role: "radiogroup"
    }, options.map(o => React.createElement("button", {
      key: o.v,
      role: "radio",
      "aria-checked": value === o.v,
      className: value === o.v ? 'is-on' : '',
      onClick: () => onChange(o.v),
      title: o.title || ''
    }, o.l)));
  }
  function useFlip(ref, sig) {
    const prev = useRef({});
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const kids = Array.from(el.querySelectorAll(':scope > [data-flip]'));
      const next = {};
      kids.forEach(k => {
        next[k.getAttribute('data-flip')] = k.getBoundingClientRect();
      });
      if (!reduceMotion()) {
        kids.forEach(k => {
          const key = k.getAttribute('data-flip'),
            a = prev.current[key],
            b = next[key];
          if (!a || !b) return;
          const dx = a.left - b.left,
            dy = a.top - b.top;
          if (!dx && !dy) return;
          k.style.transition = 'none';
          k.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          requestAnimationFrame(() => {
            k.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1)';
            k.style.transform = '';
          });
        });
      }
      prev.current = next;
    }, [sig]);
  }
  function Sortable({
    items,
    getKey,
    onMove,
    enabled,
    render,
    className,
    axis,
    style
  }) {
    const ref = useRef(null);
    const [dragKey, setDragKey] = useState(null);
    const keys = items.map(getKey);
    useFlip(ref, keys.join('|'));
    const startDrag = (e, key) => {
      if (!enabled) return;
      e.preventDefault();
      setDragKey(key);
      const onMoveP = ev => {
        const el = ref.current;
        if (!el) return;
        const kids = Array.from(el.querySelectorAll(':scope > [data-flip]'));
        const cur = kids.findIndex(k => k.getAttribute('data-flip') === key);
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
      const end = () => {
        setDragKey(null);
        window.removeEventListener('pointermove', onMoveP);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
      };
      window.addEventListener('pointermove', onMoveP);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    return React.createElement("div", {
      ref: ref,
      className: className,
      style: style
    }, items.map((it, i) => {
      const key = getKey(it);
      const handle = enabled ? React.createElement("span", {
        className: "dc-handle",
        onClick: e => e.stopPropagation()
      }, React.createElement("button", {
        className: "dc-grip",
        "aria-label": "Drag to reorder",
        onPointerDown: e => startDrag(e, key)
      }, React.createElement(Svg, {
        d: IC.grip,
        s: 14,
        sw: 3
      })), React.createElement("button", {
        className: "dc-mv",
        "aria-label": "Move up",
        disabled: i === 0,
        onClick: () => onMove(i, i - 1)
      }, React.createElement(Svg, {
        d: axis === 'x' ? 'M15 6l-6 6 6 6' : IC.up,
        s: 11,
        sw: 2.4
      })), React.createElement("button", {
        className: "dc-mv",
        "aria-label": "Move down",
        disabled: i === items.length - 1,
        onClick: () => onMove(i, i + 1)
      }, React.createElement(Svg, {
        d: axis === 'x' ? 'M9 6l6 6-6 6' : IC.down,
        s: 11,
        sw: 2.4
      }))) : null;
      return React.createElement("div", {
        key: key,
        "data-flip": key,
        className: 'dc-sort-item' + (dragKey === key ? ' is-dragging' : '')
      }, render(it, handle, i));
    }));
  }
  function DoseGauge({
    entry,
    dose,
    unit
  }) {
    const soft = entry && entry.soft || [0, 0],
      hard = entry && entry.hard;
    const top = (hard || soft[1] || 1) * 1.25;
    const W = 240,
      H = 136,
      cx = 120,
      cy = 118,
      R = 92;
    const ang = v => Math.PI + Math.max(0, Math.min(1, v / top)) * Math.PI;
    const pt = (v, r) => [cx + (r || R) * Math.cos(ang(v)), cy + (r || R) * Math.sin(ang(v))];
    const arc = (a, b) => {
      const p = pt(a),
        q = pt(b);
      return 'M' + p[0] + ' ' + p[1] + ' A' + R + ' ' + R + ' 0 0 1 ' + q[0] + ' ' + q[1];
    };
    const segs = [[0, soft[0], '#8fb7d6'], [soft[0], soft[1], '#1f9d57'], [soft[1], hard || soft[1], '#e08a1e'], [hard || soft[1], top, '#d23a52']].filter(s => s[1] > s[0]);
    const v = Number(dose);
    const has = Number.isFinite(v);
    const deg = has ? Math.max(0, Math.min(1, v / top)) * 180 - 90 : -90;
    const level = has ? D.checkLimits(entry, v) : null;
    return React.createElement("div", {
      className: "dc-gauge"
    }, React.createElement("svg", {
      viewBox: '0 0 ' + W + ' ' + H,
      width: "100%",
      style: {
        maxWidth: 260
      },
      role: "img",
      "aria-label": "Dose against the usual range"
    }, React.createElement("path", {
      d: arc(0, top),
      stroke: "rgba(125,145,180,.16)",
      strokeWidth: "16",
      fill: "none",
      strokeLinecap: "round"
    }), segs.map((s, i) => React.createElement("path", {
      key: i,
      d: arc(s[0], s[1]),
      stroke: s[2],
      strokeWidth: "14",
      fill: "none",
      opacity: ".88"
    })), [soft[0], soft[1], hard].filter(x => x != null && x > 0).map((x, i) => {
      const p = pt(x, R + 17);
      return React.createElement("text", {
        key: i,
        x: p[0],
        y: p[1],
        fontSize: "9",
        textAnchor: "middle",
        fill: "#6c7a8c",
        fontFamily: "IBM Plex Mono,monospace"
      }, fmt(x));
    }), React.createElement("g", {
      style: {
        transform: 'rotate(' + deg + 'deg)',
        transformOrigin: cx + 'px ' + cy + 'px',
        transition: 'transform .7s cubic-bezier(.34,1.56,.64,1)'
      }
    }, React.createElement("path", {
      d: 'M' + (cx - 4) + ' ' + cy + ' L' + cx + ' ' + (cy - R + 8) + ' L' + (cx + 4) + ' ' + cy + ' Z',
      fill: "#16202e"
    })), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: "8",
      fill: "#16202e"
    }), React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: "3",
      fill: "#fff"
    })), React.createElement("div", {
      className: 'dc-gauge-cap is-' + (level || 'none')
    }, level === 'ok' ? 'Within the usual range' : level === 'low' ? 'Below the usual range' : level === 'high' ? 'Above the usual range — check' : level === 'hard' ? 'OVER THE HARD LIMIT' : 'Enter a dose', React.createElement("span", null, "usual ", fmt(soft[0]), "\u2013", fmt(soft[1]), " \xB7 max ", fmt(hard), " ", unit)));
  }
  function printHtml(title, body, page) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>' + escH(title) + '</title><style>' + '@page{size:' + (page || 'A4') + ';margin:10mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}' + '.lbl{border:2px solid #111;border-radius:6px;padding:10px 12px;width:92mm;margin:0 0 8mm;page-break-inside:avoid}' + '.lbl .ha{background:#c8102e;color:#fff;font-weight:700;font-size:11px;padding:2px 6px;display:inline-block;border-radius:3px;letter-spacing:1px}' + '.lbl h1{font-size:19px;margin:6px 0 2px}.lbl .c{font-size:12px}.lbl .big{font-size:26px;font-weight:800;margin:6px 0 0}.lbl .d{font-size:13px}' + '.lbl .row{display:flex;gap:10px;font-size:11px;margin-top:7px}.lbl .row div{flex:1;border-bottom:1px solid #555;padding-top:12px}' + 'table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eef2f6}' + 'h2{font-size:15px;margin:12px 0 4px}.hd{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px}' + '.mut{color:#555;font-size:10px}.cap{color:#b00;font-weight:700}' + '</style></head><body>' + body + '</body></html>');
    doc.close();
    setTimeout(() => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch (e) {}
      setTimeout(() => {
        try {
          document.body.removeChild(f);
        } catch (e) {}
      }, 1500);
    }, 250);
  }
  function derive(p) {
    const w = parseFloat(p.weight),
      h = parseFloat(p.height);
    const ibw = D.ibw(h, p.sex);
    const adj = D.adjBw(w, ibw);
    return {
      weight: w > 0 ? w : null,
      ibw,
      adj,
      bmi: D.bmi(w, h),
      bsa: D.bsaMosteller(w, h),
      crcl: D.crclCockcroftGault({
        age: p.age,
        weight: p.basis === 'actual' ? w : adj || w,
        scr: p.scr,
        scrUnit: p.scrUnit,
        sex: p.sex
      }),
      egfr: D.egfrCkdEpi2021({
        age: p.age,
        scr: p.scr,
        scrUnit: p.scrUnit,
        sex: p.sex
      }),
      adult: D.isAdult(w, p.age)
    };
  }
  function dosingWeight(p, dv, entry) {
    if (entry && entry.weight === 'none') return null;
    if (p.basis === 'ideal' && dv.ibw) return Math.min(dv.ibw, dv.weight || dv.ibw);
    if (p.basis === 'adjusted' && dv.adj) return dv.adj;
    return dv.weight;
  }
  function PatientBar({
    p,
    set,
    dv
  }) {
    const [open, setOpen] = useState(false);
    const upd = k => v => set(Object.assign({}, p, {
      [k]: v
    }));
    const w = parseFloat(p.weight),
      a = parseFloat(p.age);
    const est = !(w > 0) && a >= 0 && a <= 12 ? D.weightFromAge(a) : null;
    const weird = w > 0 && (w < 0.4 || w > 300);
    return React.createElement("div", {
      className: "dc-card dc-patient"
    }, React.createElement("div", {
      className: "dc-pt-row"
    }, React.createElement("div", {
      className: "dc-pt-title"
    }, React.createElement("span", {
      className: "dc-pt-dot"
    }), "Patient"), React.createElement(Field, {
      label: "Weight (kg)"
    }, React.createElement(NumIn, {
      value: p.weight,
      onChange: upd('weight'),
      placeholder: "e.g. 70",
      ariaLabel: "Weight in kg"
    })), React.createElement(Field, {
      label: "Height (cm)"
    }, React.createElement(NumIn, {
      value: p.height,
      onChange: upd('height'),
      placeholder: "for IBW/BSA"
    })), React.createElement(Field, {
      label: "Age (years)"
    }, React.createElement(NumIn, {
      value: p.age,
      onChange: upd('age'),
      placeholder: "years"
    })), React.createElement(Field, {
      label: "Sex"
    }, React.createElement(Seg, {
      small: true,
      value: p.sex,
      onChange: upd('sex'),
      options: [{
        v: 'M',
        l: 'Male'
      }, {
        v: 'F',
        l: 'Female'
      }]
    })), React.createElement(Field, {
      label: "Creatinine"
    }, React.createElement("div", {
      className: "dc-inline"
    }, React.createElement(NumIn, {
      value: p.scr,
      onChange: upd('scr'),
      placeholder: p.scrUnit === 'umol' ? 'µmol/L' : 'mg/dL',
      style: {
        width: 80
      }
    }), React.createElement(Seg, {
      small: true,
      value: p.scrUnit,
      onChange: upd('scrUnit'),
      options: [{
        v: 'umol',
        l: 'µmol/L'
      }, {
        v: 'mg',
        l: 'mg/dL'
      }]
    }))), React.createElement(Field, {
      label: "Dose by"
    }, React.createElement(Seg, {
      small: true,
      value: p.basis,
      onChange: upd('basis'),
      options: [{
        v: 'actual',
        l: 'Actual',
        title: 'Actual (total) body weight'
      }, {
        v: 'ideal',
        l: 'Ideal',
        title: 'Ideal body weight (Devine) — needs height'
      }, {
        v: 'adjusted',
        l: 'Adjusted',
        title: 'IBW + 0.4 × (actual − IBW) — needs height'
      }]
    })), React.createElement("button", {
      className: "dc-link",
      onClick: () => setOpen(!open)
    }, open ? 'Hide label details' : 'Label details')), open ? React.createElement("div", {
      className: "dc-pt-row is-sub"
    }, React.createElement(Field, {
      label: "Patient name (labels only)",
      wide: true
    }, React.createElement("input", {
      className: "inp",
      value: p.name || '',
      onChange: e => upd('name')(e.target.value),
      placeholder: "optional"
    })), React.createElement(Field, {
      label: "UHID / Bed"
    }, React.createElement("input", {
      className: "inp",
      value: p.uhid || '',
      onChange: e => upd('uhid')(e.target.value),
      placeholder: "optional"
    })), React.createElement("span", {
      className: "dc-fhint",
      style: {
        alignSelf: 'end'
      }
    }, "Kept in this browser tab only \u2014 never saved or sent.")) : null, React.createElement("div", {
      className: "dc-derived"
    }, est ? React.createElement("button", {
      className: "dc-pill is-action",
      onClick: () => upd('weight')(String(est))
    }, "Use APLS estimate ", est, " kg for age ", a) : null, weird ? React.createElement("span", {
      className: "dc-pill is-red"
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 12
    }), " Check the weight \u2014 ", p.weight, " kg") : null, React.createElement("span", {
      className: "dc-pill"
    }, React.createElement("b", null, "IBW"), " ", dv.ibw ? fmt(dv.ibw, 1) + ' kg' : '—'), React.createElement("span", {
      className: "dc-pill"
    }, React.createElement("b", null, "Adj BW"), " ", dv.adj ? fmt(dv.adj, 1) + ' kg' : '—'), React.createElement("span", {
      className: "dc-pill"
    }, React.createElement("b", null, "BMI"), " ", dv.bmi ? fmt(dv.bmi, 1) : '—'), React.createElement("span", {
      className: "dc-pill"
    }, React.createElement("b", null, "BSA"), " ", dv.bsa ? fmt(dv.bsa, 2) + ' m²' : '—'), React.createElement("span", {
      className: "dc-pill",
      title: "Cockcroft\u2013Gault, using the dosing weight basis"
    }, React.createElement("b", null, "CrCl"), " ", dv.crcl ? fmt(dv.crcl, 0) + ' mL/min' : '—'), React.createElement("span", {
      className: "dc-pill",
      title: "CKD-EPI 2021"
    }, React.createElement("b", null, "eGFR"), " ", dv.egfr ? fmt(dv.egfr, 0) : '—'), React.createElement("span", {
      className: 'dc-pill ' + (dv.weight ? dv.adult ? 'is-blue' : 'is-violet' : '')
    }, dv.weight ? dv.adult ? 'Adult doses' : 'Child doses' : 'No weight yet')));
  }
  function MonographPanel({
    query
  }) {
    const [gen, setGen] = useState(null);
    const [state, setState] = useState('idle');
    const [q, setQ] = useState('');
    const load = id => api.get('/api/med/generic/' + id).then(r => {
      if (r && r.ok) {
        setGen(r.generic);
        setState('ok');
      } else setState('none');
    }).catch(() => setState('none'));
    useEffect(() => {
      const term = String(query || '').replace(/\(.*?\)/g, '').replace(/[—-].*$/, '').split(/\s+/).slice(0, 2).join(' ').trim();
      if (!term) return;
      setState('loading');
      api.get('/api/med/search?kind=generic&limit=5&q=' + encodeURIComponent(term)).then(r => {
        const g = r && r.generics && r.generics[0];
        if (g) load(g.id);else {
          setGen(null);
          setState('none');
        }
      }).catch(() => setState('none'));
    }, [query]);
    const Box = window.DrugSearchBox,
      Mono = window.MedMonograph;
    return React.createElement("div", {
      className: "dc-card dc-rise"
    }, React.createElement("div", {
      className: "dc-card-h"
    }, React.createElement(Svg, {
      d: IC.book
    }), React.createElement("b", null, "Dosage from the monograph"), React.createElement("span", {
      className: "dc-sub"
    }, "for comparison \u2014 the drug index's own text")), React.createElement("div", {
      className: "dc-card-b"
    }, Box ? React.createElement(Box, {
      value: q,
      onChange: setQ,
      onPick: p => {
        const id = p.kind === 'generic' ? p.doc.id : p.doc.genericId;
        if (id) {
          setState('loading');
          load(id);
        }
        setQ('');
      },
      placeholder: "Look up another drug's dosage section"
    }) : null, state === 'loading' ? React.createElement("div", {
      className: "dc-muted",
      style: {
        marginTop: 12
      }
    }, "Looking it up\u2026") : null, state === 'none' ? React.createElement("div", {
      className: "dc-muted",
      style: {
        marginTop: 12
      }
    }, "No monograph found for \u201C", query, "\u201D in the drug index.") : null, gen && state === 'ok' ? React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: MK.INK,
        marginBottom: 6
      }
    }, gen.name), gen.monograph && gen.monograph.dosage && Mono ? React.createElement("div", {
      className: "dc-mono"
    }, React.createElement(Mono, {
      html: gen.monograph.dosage
    })) : React.createElement("div", {
      className: "dc-muted"
    }, "No dosage section recorded for this generic.")) : null));
  }
  function DrugPicker({
    kind,
    list,
    selected,
    onPick,
    order,
    groupOrder,
    setOrder,
    setGroupOrder,
    arrange,
    favs,
    toggleFav,
    subtitle
  }) {
    const [q, setQ] = useState('');
    const [closed, setClosed] = useState({});
    const live = list.filter(e => !e.disabled);
    const ordered = D.applyOrder(live, order);
    const groups = D.applyOrder(Array.from(new Set(ordered.map(e => e.group || 'Other'))).map(g => ({
      id: g
    })), groupOrder).map(g => g.id);
    const term = q.trim().toLowerCase();
    const match = e => !term || (e.name + ' ' + (e.group || '')).toLowerCase().indexOf(term) >= 0;
    const favList = ordered.filter(e => favs.indexOf(e.id) >= 0 && match(e));
    const moveInGroup = g => (from, to) => {
      const inG = ordered.filter(e => (e.group || 'Other') === g);
      const moved = D.moveItem(inG, from, to);
      let k = 0;
      const full = ordered.map(e => (e.group || 'Other') === g ? moved[k++] : e);
      setOrder(full.map(e => e.id));
    };
    const Row = (e, handle) => React.createElement("div", {
      className: 'dc-drug' + (selected === e.id ? ' is-on' : ''),
      onClick: () => onPick(e.id),
      role: "button",
      tabIndex: 0,
      onKeyDown: ev => {
        if (ev.key === 'Enter') onPick(e.id);
      },
      style: {
        '--g': colorOf(e.group)
      }
    }, handle, React.createElement("span", {
      className: "dc-drug-bar"
    }), React.createElement("span", {
      className: "dc-drug-name"
    }, e.name, e.custom ? React.createElement("em", null, " \xB7 hospital") : null), React.createElement("span", {
      className: "dc-drug-meta"
    }, e.highAlert ? React.createElement("i", {
      className: "dc-dot is-red",
      title: "High-alert"
    }) : null, React.createElement("i", {
      className: 'dc-dot is-' + (e.reviewed.state === 'ok' ? 'green' : e.reviewed.state === 'stale' ? 'redring' : 'amber'),
      title: e.reviewed.state === 'ok' ? 'Reviewed' : e.reviewed.state === 'stale' ? 'Changed since review' : 'Not yet reviewed'
    }), React.createElement("button", {
      className: 'dc-star' + (favs.indexOf(e.id) >= 0 ? ' is-on' : ''),
      "aria-label": "Favourite",
      onClick: ev => {
        ev.stopPropagation();
        toggleFav(e.id);
      }
    }, React.createElement(Svg, {
      d: IC.star,
      s: 13
    }))));
    return React.createElement("div", {
      className: "dc-card dc-picker"
    }, React.createElement("div", {
      className: "dc-card-h"
    }, React.createElement("b", null, subtitle), React.createElement("span", {
      className: "dc-count"
    }, live.length)), React.createElement("div", {
      className: "dc-search"
    }, React.createElement(Svg, {
      d: IC.search,
      s: 14
    }), React.createElement("input", {
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: "Search drugs\u2026",
      "aria-label": "Search drugs"
    }), q ? React.createElement("button", {
      onClick: () => setQ(''),
      "aria-label": "Clear"
    }, React.createElement(Svg, {
      d: IC.x,
      s: 12
    })) : null), React.createElement("div", {
      className: "dc-picker-scroll"
    }, favList.length && !arrange ? React.createElement("div", {
      className: "dc-group"
    }, React.createElement("div", {
      className: "dc-group-h is-fav"
    }, React.createElement(Svg, {
      d: IC.star,
      s: 12
    }), "Favourites"), favList.map(e => React.createElement("div", {
      key: 'f' + e.id
    }, Row(e, null)))) : null, React.createElement(Sortable, {
      items: groups.map(g => ({
        id: g
      })),
      getKey: g => g.id,
      enabled: arrange && !term,
      onMove: (a, b) => setGroupOrder(D.moveItem(groups, a, b)),
      render: (g, handle) => {
        const rows = ordered.filter(e => (e.group || 'Other') === g.id && match(e));
        if (!rows.length) return null;
        const isClosed = closed[g.id] && !term;
        return React.createElement("div", {
          className: "dc-group",
          style: {
            '--g': colorOf(g.id)
          }
        }, React.createElement("div", {
          className: "dc-group-h"
        }, handle, React.createElement("button", {
          className: "dc-group-t",
          onClick: () => setClosed(Object.assign({}, closed, {
            [g.id]: !closed[g.id]
          })),
          "aria-expanded": !isClosed
        }, React.createElement("span", {
          className: "dc-gdot"
        }), g.id, React.createElement("span", {
          className: "dc-count"
        }, rows.length), React.createElement("span", {
          className: 'dc-chev' + (isClosed ? '' : ' is-open')
        }, React.createElement(Svg, {
          d: IC.down,
          s: 12
        })))), isClosed ? null : React.createElement(Sortable, {
          items: rows,
          getKey: e => e.id,
          enabled: arrange && !term,
          onMove: moveInGroup(g.id),
          render: (e, h) => Row(e, h)
        }));
      }
    }), !ordered.some(match) ? React.createElement("div", {
      className: "dc-muted",
      style: {
        padding: 16
      }
    }, "Nothing matches \u201C", q, "\u201D.") : null));
  }
  function InfusionTab({
    lib,
    p,
    dv,
    prefs,
    layout,
    setPref,
    arrange,
    restore,
    onRecent,
    admin
  }) {
    const list = lib.infusion;
    const firstId = (D.applyOrder(list.filter(e => !e.disabled), (prefs.order || {}).infusion || layout.infusion)[0] || {}).id;
    const [drugId, setDrugId] = useState(() => restore && restore.drugId || prefs.lastInfusion || firstId);
    const entry = list.find(e => e.id === drugId && !e.disabled) || list.find(e => e.id === firstId);
    const [ci, setCi] = useState(0);
    const [custom, setCustom] = useState({
      amount: '',
      unit: 'mg',
      ml: '50'
    });
    const [mode, setMode] = useState('dose');
    const [doseVal, setDoseVal] = useState(entry ? String(entry.start) : '');
    const [rateVal, setRateVal] = useState('');
    const [showMono, setShowMono] = useState(false);
    const [pumpKey, setPumpKey] = useState(0);
    const pick = id => {
      const e = list.find(x => x.id === id);
      setDrugId(id);
      setCi(0);
      setMode('dose');
      setDoseVal(e ? String(e.start) : '');
      setRateVal('');
      setPumpKey(k => k + 1);
      setPref({
        lastInfusion: id
      });
    };
    useEffect(() => {
      if (!restore) return;
      setDrugId(restore.drugId);
      setCi(restore.ci || 0);
      setMode('dose');
      setDoseVal(String(restore.dose));
      setPumpKey(k => k + 1);
      if (restore.custom) setCustom(restore.custom);
    }, [restore]);
    if (!entry) return React.createElement("div", {
      className: "dc-card"
    }, React.createElement("div", {
      className: "dc-empty"
    }, "Every infusion is switched off in the library."));
    const concs = entry.conc || [];
    const conc = ci === 'custom' ? {
      label: 'Custom',
      amount: parseFloat(custom.amount),
      unit: custom.unit,
      ml: parseFloat(custom.ml)
    } : concs[ci] || concs[0];
    const u = D.parseUnit(entry.unit);
    const w = dosingWeight(p, dv, entry);
    const needW = u.perKg && !(w > 0);
    const perMlDose = D.concPerMl(conc, u.amount);
    const dose = mode === 'dose' ? parseFloat(doseVal) : D.doseFromRate({
      rate: parseFloat(rateVal),
      unit: entry.unit,
      weight: w,
      conc
    });
    const rate = mode === 'dose' ? D.rateFromDose({
      dose: parseFloat(doseVal),
      unit: entry.unit,
      weight: w,
      conc
    }) : parseFloat(rateVal);
    const pumpRate = rate != null && Number.isFinite(rate) ? D.roundToPump(rate) : null;
    const delivered = pumpRate != null ? D.doseFromRate({
      rate: pumpRate,
      unit: entry.unit,
      weight: w,
      conc
    }) : null;
    const level = dose != null && Number.isFinite(dose) ? D.checkLimits(entry, dose) : null;
    const maxDose = (entry.hard || (entry.soft || [])[1] || 1) * 1.25;
    const maxRate = D.rateFromDose({
      dose: maxDose,
      unit: entry.unit,
      weight: w || 70,
      conc
    }) || 50;
    const prep = ci === 'custom' ? null : D.prepPlan(conc, entry.ampoule);
    const totals = pumpRate ? D.dailyTotals(entry, conc, pumpRate) : null;
    const table = D.titrationTable(entry, conc, w || null, 16);
    const color = colorOf(entry.group);
    const isSyringe = !(conc && conc.ml > 60);
    const ideal = entry.weight === 'ideal' && p.basis === 'actual' && dv.ibw && dv.weight && dv.weight > dv.ibw * 1.2;
    const onPumpRate = r => {
      if (mode === 'rate') setRateVal(String(r));else {
        const d = D.doseFromRate({
          rate: r,
          unit: entry.unit,
          weight: w,
          conc
        });
        if (d != null) setDoseVal(String(D.round(d, 4)));
      }
    };
    const stepDose = dir => {
      if (mode === 'dose') setDoseVal(String(Math.max(0, D.round((parseFloat(doseVal) || 0) + dir * entry.step, 4))));else setRateVal(String(Math.max(0, D.roundToPump((parseFloat(rateVal) || 0) + dir * (isSyringe ? 0.1 : 1)))));
    };
    const concText = conc && conc.amount > 0 ? fmt(conc.amount) + ' ' + conc.unit + ' in ' + fmt(conc.ml) + ' mL = ' + fmt(perMlDose) + ' ' + u.amount + '/mL' : 'Enter a concentration';
    const doseText = dose != null && Number.isFinite(dose) ? fmt(dose) + ' ' + entry.unit : '';
    const printLabel = () => {
      if (level === 'hard') {
        toast('Over the hard limit — no label printed.', 'error');
        return;
      }
      const when = new Date().toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const one = '<div class="lbl">' + (entry.highAlert ? '<span class="ha">HIGH-ALERT · TWO-PERSON CHECK</span>' : '') + '<h1>' + escH(entry.name) + '</h1><div class="c">' + escH(concText) + (entry.diluent ? ' · ' + escH(entry.diluent) : '') + '</div>' + '<div class="big">' + fmt(pumpRate) + ' mL/h</div><div class="d">= ' + fmt(delivered) + ' ' + escH(entry.unit) + (u.perKg ? ' @ ' + fmt(w, 1) + ' kg' + (p.basis !== 'actual' ? ' (' + p.basis + ' BW)' : '') : '') + '</div>' + '<div class="c" style="margin-top:6px">Patient: <b>' + escH(p.name || '__________________') + '</b> &nbsp; UHID/Bed: <b>' + escH(p.uhid || '__________') + '</b></div>' + '<div class="row"><div>Prepared by</div><div>Checked by</div></div><div class="row"><div>Date/time: ' + escH(when) + '</div><div>Expires</div></div>' + '<div class="mut" style="margin-top:6px">UNICO dose calculator · ' + escH(entry.reviewed.state === 'ok' ? 'library reviewed by ' + entry.reviewed.by : 'library entry not yet reviewed by pharmacy') + '</div></div>';
      printHtml('Infusion label — ' + entry.name, one + one, 'A4');
      onRecent({
        kind: 'infusion',
        drugId: entry.id,
        ci,
        custom: ci === 'custom' ? custom : null,
        dose: D.round(dose, 4),
        weight: p.weight,
        label: entry.name + ' ' + fmt(dose) + ' ' + entry.unit + ' → ' + fmt(pumpRate) + ' mL/h'
      });
    };
    return React.createElement("div", {
      className: "dc-inf"
    }, React.createElement(DrugPicker, {
      kind: "infusion",
      list: list,
      selected: entry.id,
      onPick: pick,
      subtitle: "ICU drug library",
      order: (prefs.order || {}).infusion || layout.infusion,
      groupOrder: (prefs.groups || {}).infusion || (layout.groups || {}).infusion,
      setOrder: o => setPref({
        order: Object.assign({}, prefs.order, {
          infusion: o
        })
      }),
      setGroupOrder: o => setPref({
        groups: Object.assign({}, prefs.groups, {
          infusion: o
        })
      }),
      arrange: arrange,
      favs: prefs.favs || [],
      toggleFav: id => setPref({
        favs: (prefs.favs || []).indexOf(id) >= 0 ? prefs.favs.filter(x => x !== id) : [id].concat(prefs.favs || [])
      })
    }), React.createElement("div", {
      className: "dc-col"
    }, React.createElement("div", {
      className: "dc-card dc-rise",
      key: 'c' + entry.id,
      style: {
        '--g': color
      }
    }, React.createElement("div", {
      className: "dc-drug-head"
    }, React.createElement("span", {
      className: "dc-drug-swatch"
    }), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      className: "dc-drug-title"
    }, entry.name), React.createElement("div", {
      className: "dc-chips"
    }, React.createElement("span", {
      className: "dc-chip"
    }, entry.group), React.createElement("span", {
      className: "dc-chip is-mono"
    }, entry.unit), entry.highAlert ? React.createElement(HighAlert, null) : null, React.createElement(ReviewChip, {
      e: entry
    })))), React.createElement("div", {
      className: "dc-card-b"
    }, React.createElement("div", {
      className: "dc-label-row"
    }, "Concentration"), React.createElement("div", {
      className: "dc-conc"
    }, concs.map((c, i) => React.createElement("button", {
      key: i,
      className: 'dc-conc-chip' + (ci === i ? ' is-on' : ''),
      onClick: () => {
        setCi(i);
        setPumpKey(k => k + 1);
      }
    }, React.createElement("b", null, fmt(c.amount), " ", c.unit, " / ", fmt(c.ml), " mL"), React.createElement("span", null, c.label, " \xB7 ", fmt(D.concPerMl(c, u.amount)), " ", u.amount, "/mL"))), React.createElement("button", {
      className: 'dc-conc-chip' + (ci === 'custom' ? ' is-on' : ''),
      onClick: () => {
        setCi('custom');
        setPumpKey(k => k + 1);
      }
    }, React.createElement("b", null, "Custom"), React.createElement("span", null, "your own mix"))), ci === 'custom' ? React.createElement("div", {
      className: "dc-inline dc-rise",
      style: {
        marginTop: 8
      }
    }, React.createElement(NumIn, {
      value: custom.amount,
      onChange: v => setCustom(Object.assign({}, custom, {
        amount: v
      })),
      placeholder: "amount",
      style: {
        width: 90
      },
      autoFocus: true
    }), React.createElement("select", {
      className: "inp",
      value: custom.unit,
      onChange: e => setCustom(Object.assign({}, custom, {
        unit: e.target.value
      }))
    }, AMOUNT_UNITS.map(x => React.createElement("option", {
      key: x
    }, x))), React.createElement("span", {
      className: "dc-muted"
    }, "in"), React.createElement(NumIn, {
      value: custom.ml,
      onChange: v => setCustom(Object.assign({}, custom, {
        ml: v
      })),
      placeholder: "mL",
      style: {
        width: 70
      }
    }), React.createElement("span", {
      className: "dc-muted"
    }, "mL")) : null, React.createElement("div", {
      className: "dc-io"
    }, React.createElement("div", {
      className: "dc-io-in"
    }, React.createElement("div", {
      className: "dc-label-row",
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }
    }, React.createElement("span", null, mode === 'dose' ? 'Dose (' + entry.unit + ')' : 'Pump rate (mL/h)'), React.createElement(Seg, {
      small: true,
      value: mode,
      onChange: m => {
        if (m === mode) return;
        if (m === 'rate') setRateVal(pumpRate != null ? String(pumpRate) : '');else setDoseVal(dose != null && Number.isFinite(dose) ? String(D.round(dose, 4)) : '');
        setMode(m);
      },
      options: [{
        v: 'dose',
        l: 'Dose → mL/h'
      }, {
        v: 'rate',
        l: 'mL/h → dose'
      }]
    })), React.createElement("div", {
      className: "dc-big-in"
    }, React.createElement("button", {
      className: "dc-step-big",
      onClick: () => stepDose(-1),
      "aria-label": "Down one step"
    }, "\u2212"), React.createElement("input", {
      className: "dc-big-num",
      type: "number",
      inputMode: "decimal",
      step: "any",
      min: "0",
      value: mode === 'dose' ? doseVal : rateVal,
      onChange: e => mode === 'dose' ? setDoseVal(e.target.value) : setRateVal(e.target.value),
      "aria-label": mode === 'dose' ? 'Dose' : 'Rate'
    }), React.createElement("button", {
      className: "dc-step-big",
      onClick: () => stepDose(1),
      "aria-label": "Up one step"
    }, "+")), React.createElement("input", {
      type: "range",
      className: "dc-range",
      min: "0",
      max: mode === 'dose' ? maxDose : D.round(maxRate, 1),
      step: mode === 'dose' ? entry.step / 10 : 0.1,
      value: (mode === 'dose' ? parseFloat(doseVal) : parseFloat(rateVal)) || 0,
      style: {
        '--g': color
      },
      onChange: e => mode === 'dose' ? setDoseVal(e.target.value) : setRateVal(e.target.value),
      "aria-label": "Adjust"
    }), React.createElement("div", {
      className: "dc-fhint"
    }, "Titration step ", fmt(entry.step), " ", entry.unit, " \xB7 usual start ", fmt(entry.start))), React.createElement("div", {
      className: 'dc-result is-' + (level || 'none')
    }, needW ? React.createElement("div", {
      className: "dc-need"
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 18
    }), " Enter the patient's weight \u2014 this is a per-kg dose.") : React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dc-result-k"
    }, mode === 'dose' ? 'Set the pump to' : 'This rate delivers'), React.createElement("div", {
      className: "dc-result-v"
    }, mode === 'dose' ? React.createElement(React.Fragment, null, React.createElement(Tween, {
      value: pumpRate
    }), React.createElement("small", null, " mL/h")) : React.createElement(React.Fragment, null, React.createElement(Tween, {
      value: dose
    }), React.createElement("small", null, " ", entry.unit))), mode === 'dose' && rate != null && Math.abs(rate - pumpRate) > 1e-9 ? React.createElement("div", {
      className: "dc-result-s"
    }, "exact ", fmt(rate, 3), " mL/h \xB7 at ", fmt(pumpRate), " mL/h the patient gets ", fmt(delivered), " ", entry.unit) : null, u.perKg ? React.createElement("div", {
      className: "dc-result-s"
    }, "for ", fmt(w, 1), " kg", p.basis !== 'actual' ? ' (' + p.basis + ' body weight)' : '') : React.createElement("div", {
      className: "dc-result-s"
    }, "not weight-based"), level === 'hard' ? React.createElement("div", {
      className: "dc-banner is-red"
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 14
    }), " Over the hard limit of ", fmt(entry.hard), " ", entry.unit, ". Label printing and the pump are locked.") : null, level === 'high' ? React.createElement("div", {
      className: "dc-banner is-amber"
    }, "Above the usual range (", fmt(entry.soft[1]), " ", entry.unit, "). Confirm with the prescriber.") : null, level === 'low' ? React.createElement("div", {
      className: "dc-banner is-amber"
    }, "Below the usual range (", fmt(entry.soft[0]), " ", entry.unit, ").") : null))), ideal ? React.createElement("div", {
      className: "dc-banner is-blue",
      style: {
        marginTop: 10
      }
    }, "This drug is usually dosed on ", React.createElement("b", null, "ideal body weight"), " in obesity (", fmt(dv.ibw, 1), " kg). Switch \u201CDose by\u201D to Ideal in the patient bar.") : null, React.createElement("div", {
      className: "dc-two",
      style: {
        marginTop: 14
      }
    }, React.createElement(DoseGauge, {
      entry: entry,
      dose: dose,
      unit: entry.unit
    }), React.createElement("div", {
      className: "dc-facts"
    }, React.createElement("div", {
      className: "dc-fact"
    }, React.createElement("span", null, "Concentration"), React.createElement("b", null, concText)), prep ? React.createElement("div", {
      className: "dc-fact"
    }, React.createElement("span", null, React.createElement(Svg, {
      d: IC.flask,
      s: 12
    }), " Preparation"), React.createElement("b", null, prep.impossible ? 'The ampoules do not fit in this volume — check the concentration.' : 'Open ' + prep.open + ' × ' + (entry.ampoule.label || fmt(entry.ampoule.amount) + ' ' + entry.ampoule.unit) + ', draw ' + fmt(prep.drawMl) + ' mL' + (prep.undiluted ? ' — use undiluted.' : ', add ' + fmt(prep.diluentMl) + ' mL ' + (entry.diluent || 'diluent') + ' to ' + fmt(conc.ml) + ' mL.'))) : null, totals ? React.createElement("div", {
      className: "dc-fact"
    }, React.createElement("span", null, "Per 24 h at ", fmt(pumpRate), " mL/h"), React.createElement("b", null, fmt(totals.ml, 0), " mL fluid \xB7 ", fmt(totals.amount), " ", totals.unit, " of drug")) : null, pumpRate ? React.createElement("div", {
      className: "dc-fact"
    }, React.createElement("span", null, React.createElement(Svg, {
      d: IC.clock,
      s: 12
    }), " ", isSyringe ? 'Syringe' : 'Bag', " lasts"), React.createElement("b", null, fmt(conc.ml / pumpRate, 1), " h")) : null)), entry.notes ? React.createElement("div", {
      className: "dc-note"
    }, entry.notes) : null, React.createElement("div", {
      className: "dc-src"
    }, "Source: ", entry.source, entry.custom ? ' · hospital-added' : entry.overridden ? ' · edited by the hospital' : ''), React.createElement("div", {
      className: "dc-actions"
    }, React.createElement("button", {
      style: MK.btnPri,
      disabled: level === 'hard' || needW || !pumpRate,
      onClick: printLabel
    }, React.createElement(Svg, {
      d: IC.print,
      s: 14
    }), " Print syringe label"), React.createElement("button", {
      style: MK.btnGhost,
      disabled: needW || !pumpRate,
      onClick: () => onRecent({
        kind: 'infusion',
        drugId: entry.id,
        ci,
        custom: ci === 'custom' ? custom : null,
        dose: D.round(dose, 4),
        weight: p.weight,
        label: entry.name + ' ' + fmt(dose) + ' ' + entry.unit + ' → ' + fmt(pumpRate) + ' mL/h'
      })
    }, React.createElement(Svg, {
      d: IC.save,
      s: 14
    }), " Save to recent"), React.createElement("button", {
      style: MK.btnGhost,
      onClick: () => setShowMono(!showMono)
    }, React.createElement(Svg, {
      d: IC.book,
      s: 14
    }), " ", showMono ? 'Hide' : 'Show', " monograph")))), table.length ? React.createElement("div", {
      className: "dc-card dc-rise"
    }, React.createElement("div", {
      className: "dc-card-h"
    }, React.createElement("b", null, "Titration chart"), React.createElement("span", {
      className: "dc-sub"
    }, concText, u.perKg ? ' · ' + fmt(w, 1) + ' kg' : '', " \u2014 click a row to set it")), React.createElement("div", {
      className: "dc-ttable"
    }, table.map((r, i) => {
      const cur = dose != null && Math.abs(r.dose - dose) < entry.step / 2;
      return React.createElement("button", {
        key: i,
        className: 'dc-trow is-' + r.level + (cur ? ' is-cur' : ''),
        onClick: () => {
          setMode('dose');
          setDoseVal(String(r.dose));
        }
      }, React.createElement("span", null, fmt(r.dose), " ", React.createElement("i", null, entry.unit)), React.createElement("b", null, r.rate == null ? '—' : fmt(r.rate), " ", React.createElement("i", null, "mL/h")));
    }))) : null, showMono ? React.createElement(MonographPanel, {
      query: entry.name
    }) : null), React.createElement("div", {
      className: "dc-col dc-pump-col"
    }, React.createElement("div", {
      className: "dc-card dc-rise"
    }, React.createElement("div", {
      className: "dc-card-h"
    }, React.createElement("b", null, isSyringe ? 'Syringe pump' : 'Volumetric pump'), React.createElement("span", {
      className: "dc-sub"
    }, "live simulation")), React.createElement("div", {
      className: "dc-card-b",
      style: {
        paddingTop: 8
      }
    }, needW ? React.createElement("div", {
      className: "dc-empty"
    }, "Enter a weight to run the pump.") : isSyringe ? React.createElement(window.DosePumps.SyringePump, {
      key: pumpKey,
      drug: entry.name,
      color: color,
      rate: pumpRate,
      volume: conc && conc.ml,
      doseText: doseText ? '= ' + doseText : '',
      level: level,
      onRate: onPumpRate,
      step: 0.1,
      bolusMl: BOLUS_GROUPS[entry.group] ? 1 : null,
      maxRate: maxRate
    }) : React.createElement(window.DosePumps.InfusionPump, {
      key: pumpKey,
      fluid: entry.name.split(' ')[0] + ' ' + fmt(conc.amount) + conc.unit,
      color: color,
      rate: pumpRate,
      volume: conc && conc.ml,
      dropFactor: 20,
      doseText: doseText ? '= ' + doseText : '',
      level: level,
      onRate: onPumpRate,
      step: 1,
      maxRate: maxRate
    }), React.createElement("div", {
      className: "dc-fhint",
      style: {
        marginTop: 8
      }
    }, "A simulation to check the set-up \u2014 it does not control any device. Turn the knob or use \u25B2\u25BC and the dose above follows.")))));
  }
  function EmergencyTab({
    lib,
    p,
    dv,
    prefs,
    layout,
    setPref,
    arrange,
    admin
  }) {
    const [q, setQ] = useState('');
    const w = dv.weight,
      age = parseFloat(p.age);
    const live = D.applyOrder(lib.emergency.filter(e => !e.disabled), (prefs.order || {}).emergency || layout.emergency);
    const groups = D.applyOrder(Array.from(new Set(live.map(e => e.group))).map(g => ({
      id: g
    })), (prefs.groups || {}).emergency || (layout.groups || {}).emergency).map(g => g.id);
    const airway = D.airway(Number.isFinite(age) ? age : null);
    const fluid = D.maintenance421(w);
    const term = q.trim().toLowerCase();
    const doseStr = (d, unit) => !d ? '—' : d.single ? fmt(d.lo) + ' ' + unit : fmt(d.lo) + '–' + fmt(d.hi) + ' ' + unit;
    const mlStr = d => !d || !d.ml ? '' : Math.abs(d.ml[1] - d.ml[0]) < 1e-9 ? fmt(d.ml[0]) + ' mL' : fmt(d.ml[0]) + '–' + fmt(d.ml[1]) + ' mL';
    const print = () => {
      const when = new Date().toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      let h = '<div class="hd"><div><b style="font-size:17px">Emergency drug sheet</b><div class="mut">UNICO dose calculator · ' + escH(when) + '</div></div>' + '<div style="text-align:right"><b>' + escH(p.name || '') + '</b> ' + escH(p.uhid || '') + '<div>Weight <b>' + fmt(w, 1) + ' kg</b>' + (Number.isFinite(age) ? ' · Age ' + age + ' y' : '') + ' · ' + (dv.adult ? 'Adult doses' : 'Child doses') + '</div></div></div>';
      groups.forEach(g => {
        const rows = live.filter(e => e.group === g);
        h += '<h2>' + escH(g) + '</h2><table><tr><th style="width:30%">Drug</th><th>Dose</th><th>Volume</th><th>Preparation</th><th>Route</th><th style="width:26%">Notes</th></tr>';
        rows.forEach(e => {
          const d = D.emergencyDose(e, w, age);
          h += '<tr><td><b>' + escH(e.name) + '</b><div class="mut">' + (Array.isArray(e.dose) ? fmt(e.dose[0]) + '–' + fmt(e.dose[1]) : fmt(e.dose)) + ' ' + escH(e.unit) + '/kg' + (e.max ? ', max ' + fmt(e.max) : '') + '</div></td><td><b>' + doseStr(d, e.unit) + '</b>' + (d && d.capped ? ' <span class="cap">MAX</span>' : '') + (d && d.adult ? ' <span class="mut">adult</span>' : '') + '</td><td>' + mlStr(d) + '</td><td>' + escH(e.prep) + '</td><td>' + escH(e.route) + '</td><td class="mut">' + escH(e.notes) + '</td></tr>';
        });
        h += '</table>';
      });
      h += '<h2>Electrical</h2><table><tr><th>Therapy</th><th>Energy</th><th>Notes</th></tr>' + LIB.ELECTRICAL.map(e => {
        const d = D.electricalDose(e, w, age);
        return '<tr><td>' + escH(e.name) + '</td><td><b>' + (d ? (Math.abs(d.hi - d.lo) < 1e-9 ? fmt(d.lo, 0) : fmt(d.lo, 0) + '–' + fmt(d.hi, 0)) + ' J' : '—') + '</b></td><td class="mut">' + escH(e.notes) + '</td></tr>';
      }).join('') + '</table>';
      if (airway) h += '<h2>Airway & fluids</h2><table><tr><td>ETT cuffed / uncuffed</td><td><b>' + (airway.cuffed || '—') + ' / ' + (airway.uncuffed || '—') + '</b>' + (airway.depth ? ' · oral depth ' + airway.depth + ' cm' : '') + '</td><td class="mut">' + escH(airway.note) + '</td></tr>' + (fluid ? '<tr><td>Maintenance fluid</td><td><b>' + fmt(fluid.mlPerHour) + ' mL/h</b> (' + fmt(fluid.mlPerDay, 0) + ' mL/day)</td><td class="mut">Holliday–Segar 4-2-1</td></tr>' : '') + '</table>';
      h += '<div style="display:flex;gap:30px;margin-top:16px;font-size:11px"><div style="flex:1;border-top:1px solid #333;padding-top:3px">Calculated by</div><div style="flex:1;border-top:1px solid #333;padding-top:3px">Checked by</div></div>' + '<p class="mut">Calculation aid only — verify against the prescription and hospital protocol. Library entries not reviewed by pharmacy are defaults from ' + escH('AHA PALS / ACLS 2020 and APLS') + '.</p>';
      printHtml('Emergency drug sheet', h, 'A4');
    };
    if (!w) return React.createElement("div", {
      className: "dc-card dc-rise"
    }, React.createElement("div", {
      className: "dc-empty"
    }, React.createElement("b", null, "Enter a weight"), " in the patient bar (or an age up to 12 for the APLS estimate) and the whole resuscitation sheet is calculated."));
    return React.createElement("div", {
      className: "dc-col"
    }, React.createElement("div", {
      className: "dc-em-top"
    }, React.createElement("div", {
      className: "dc-stat is-big"
    }, React.createElement("span", null, "Weight"), React.createElement("b", null, fmt(w, 1), " kg"), React.createElement("i", null, dv.adult ? 'adult doses' : 'child doses')), LIB.ELECTRICAL.slice(0, 2).map(e => {
      const d = D.electricalDose(e, w, age);
      return React.createElement("div", {
        key: e.id,
        className: "dc-stat is-red"
      }, React.createElement("span", null, e.name.replace('Defibrillation — ', 'Shock — ')), React.createElement("b", null, d ? fmt(d.lo, 0) : '—', " J"), React.createElement("i", null, Array.isArray(e.jPerKg) ? e.jPerKg.join('–') : e.jPerKg, " J/kg", d && d.adult ? ' · adult' : ''));
    }), React.createElement("div", {
      className: "dc-stat"
    }, React.createElement("span", null, "ETT (cuffed)"), React.createElement("b", null, airway && airway.cuffed ? airway.cuffed : '—'), React.createElement("i", null, airway ? airway.depth ? 'oral depth ' + airway.depth + ' cm' : airway.note : 'enter age')), React.createElement("div", {
      className: "dc-stat"
    }, React.createElement("span", null, "Maintenance"), React.createElement("b", null, fluid ? fmt(fluid.mlPerHour) : '—', " mL/h"), React.createElement("i", null, "4-2-1 rule")), React.createElement("div", {
      className: "dc-stat"
    }, React.createElement("span", null, "Fluid bolus"), React.createElement("b", null, fmt(Math.min(w * 10, 1000), 0), "\u2013", fmt(Math.min(w * 20, 1000), 0), " mL"), React.createElement("i", null, "10\u201320 mL/kg"))), React.createElement("div", {
      className: "dc-card dc-rise"
    }, React.createElement("div", {
      className: "dc-card-h"
    }, React.createElement("b", null, "Weight-based emergency drugs"), React.createElement("div", {
      className: "dc-search is-inline"
    }, React.createElement(Svg, {
      d: IC.search,
      s: 14
    }), React.createElement("input", {
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: "Filter\u2026"
    })), React.createElement("button", {
      style: Object.assign({}, MK.btnPri, {
        marginLeft: 'auto'
      }),
      onClick: print
    }, React.createElement(Svg, {
      d: IC.print,
      s: 14
    }), " Print A4 sheet")), React.createElement(Sortable, {
      items: groups.map(g => ({
        id: g
      })),
      getKey: g => g.id,
      enabled: arrange && !term,
      onMove: (a, b) => setPref({
        groups: Object.assign({}, prefs.groups, {
          emergency: D.moveItem(groups, a, b)
        })
      }),
      render: (g, handle) => {
        const rows = live.filter(e => e.group === g.id && (!term || e.name.toLowerCase().indexOf(term) >= 0));
        if (!rows.length) return null;
        return React.createElement("div", {
          className: "dc-em-group",
          style: {
            '--g': colorOf(g.id)
          }
        }, React.createElement("div", {
          className: "dc-em-gh"
        }, handle, React.createElement("span", {
          className: "dc-gdot"
        }), g.id), React.createElement(Sortable, {
          items: rows,
          getKey: e => e.id,
          enabled: arrange && !term,
          onMove: (a, b) => {
            const moved = D.moveItem(rows, a, b);
            let k = 0;
            setPref({
              order: Object.assign({}, prefs.order, {
                emergency: live.map(e => e.group === g.id ? moved[k++] : e).map(e => e.id)
              })
            });
          },
          render: (e, h) => {
            const d = D.emergencyDose(e, w, age);
            return React.createElement("div", {
              className: "dc-em-row"
            }, h, React.createElement("div", {
              className: "dc-em-name"
            }, React.createElement("b", null, e.name), React.createElement("span", null, Array.isArray(e.dose) ? fmt(e.dose[0]) + '–' + fmt(e.dose[1]) : fmt(e.dose), " ", e.unit, "/kg", e.max ? ' · max ' + fmt(e.max) + ' ' + e.unit : '')), React.createElement("div", {
              className: "dc-em-dose"
            }, React.createElement("b", null, doseStr(d, e.unit)), d && d.capped ? React.createElement("span", {
              className: "dc-chip is-red"
            }, "MAX") : null, d && d.adult ? React.createElement("span", {
              className: "dc-chip is-blue"
            }, "adult") : null), React.createElement("div", {
              className: "dc-em-ml"
            }, mlStr(d) || React.createElement("span", {
              className: "dc-muted"
            }, "\u2014"), React.createElement("span", null, e.prep)), React.createElement("div", {
              className: "dc-em-route"
            }, e.route), React.createElement("div", {
              className: "dc-em-note"
            }, e.notes, React.createElement(ReviewChip, {
              e: e,
              compact: true
            })));
          }
        }));
      }
    }), React.createElement("div", {
      className: "dc-card-b",
      style: {
        borderTop: '1px solid ' + MK.LINE
      }
    }, React.createElement("div", {
      className: "dc-em-elec"
    }, LIB.ELECTRICAL.map(e => {
      const d = D.electricalDose(e, w, age);
      return React.createElement("div", {
        key: e.id,
        className: "dc-fact"
      }, React.createElement("span", null, e.name), React.createElement("b", null, d ? (Math.abs(d.hi - d.lo) < 1e-9 ? fmt(d.lo, 0) : fmt(d.lo, 0) + '–' + fmt(d.hi, 0)) + ' J' : '—'), React.createElement("i", {
        className: "dc-muted"
      }, e.notes));
    })))));
  }
  function OralSyringe({
    ml,
    color
  }) {
    const v = Number(ml);
    if (!(v > 0)) return null;
    if (v > 10) {
      const frac = Math.min(1, v / 30);
      return React.createElement("svg", {
        viewBox: "0 0 120 130",
        width: "110",
        className: "dc-oral",
        role: "img",
        "aria-label": fmt(v) + ' mL in a medicine cup'
      }, React.createElement("path", {
        d: "M20 20 L100 20 L90 120 L30 120 Z",
        fill: "rgba(235,244,252,.75)",
        stroke: "rgba(31,59,90,.4)"
      }), React.createElement("clipPath", {
        id: "cupClip"
      }, React.createElement("path", {
        d: "M20 20 L100 20 L90 120 L30 120 Z"
      })), React.createElement("rect", {
        x: "0",
        y: 120 - frac * 100,
        width: "120",
        height: frac * 100,
        fill: color,
        opacity: ".6",
        clipPath: "url(#cupClip)",
        style: {
          transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
        }
      }), [5, 10, 15, 20, 25, 30].map(m => React.createElement("g", {
        key: m
      }, React.createElement("line", {
        x1: "22",
        x2: "34",
        y1: 120 - m / 30 * 100,
        y2: 120 - m / 30 * 100,
        stroke: "rgba(31,59,90,.5)"
      }), React.createElement("text", {
        x: "38",
        y: 123 - m / 30 * 100,
        fontSize: "8",
        fill: "#3c4858"
      }, m))));
    }
    const X0 = 22,
      X1 = 182,
      frac = Math.min(1, v / 10);
    const head = X0 + frac * (X1 - X0);
    return React.createElement("svg", {
      viewBox: "0 0 240 70",
      width: "100%",
      style: {
        maxWidth: 300
      },
      className: "dc-oral",
      role: "img",
      "aria-label": 'Draw up ' + fmt(v) + ' mL'
    }, React.createElement("rect", {
      x: X1,
      y: "29",
      width: "22",
      height: "12",
      rx: "3",
      fill: "#e9eef4",
      stroke: "rgba(31,59,90,.35)"
    }), React.createElement("rect", {
      x: X0,
      y: "18",
      width: X1 - X0,
      height: "34",
      rx: "6",
      fill: "rgba(235,244,252,.75)",
      stroke: "rgba(31,59,90,.4)"
    }), React.createElement("rect", {
      x: X0 + 2,
      y: "21",
      width: Math.max(0, head - X0 - 2),
      height: "28",
      rx: "4",
      fill: color,
      opacity: ".6",
      style: {
        transition: 'width .6s cubic-bezier(.2,.8,.2,1)'
      }
    }), [...Array(21)].map((_, i) => {
      const x = X0 + i / 20 * (X1 - X0);
      return React.createElement("line", {
        key: i,
        x1: x,
        x2: x,
        y1: "18",
        y2: i % 2 ? 24 : 28,
        stroke: "rgba(31,59,90,.45)"
      });
    }), [0, 2, 4, 6, 8, 10].map(m => React.createElement("text", {
      key: m,
      x: X0 + m / 10 * (X1 - X0),
      y: "64",
      fontSize: "8",
      textAnchor: "middle",
      fill: "#3c4858"
    }, m)), React.createElement("g", {
      style: {
        transform: 'translateX(' + (head - X0) + 'px)',
        transition: 'transform .6s cubic-bezier(.2,.8,.2,1)'
      }
    }, React.createElement("rect", {
      x: X0 - 2,
      y: "16",
      width: "6",
      height: "38",
      rx: "2",
      fill: "#2d3a4a"
    }), React.createElement("rect", {
      x: "-60",
      y: "31",
      width: X0 + 58,
      height: "8",
      rx: "2",
      fill: "#d7dee7",
      stroke: "rgba(31,59,90,.25)",
      transform: 'translate(' + 0 + ' 0)'
    })));
  }
  function PaedTab({
    lib,
    p,
    dv,
    prefs,
    layout,
    setPref,
    arrange
  }) {
    const list = lib.paed;
    const firstId = (D.applyOrder(list.filter(e => !e.disabled), (prefs.order || {}).paed || layout.paed)[0] || {}).id;
    const [id, setId] = useState(prefs.lastPaed || firstId);
    const entry = list.find(e => e.id === id && !e.disabled) || list.find(e => e.id === firstId);
    const [si, setSi] = useState(0);
    const [perKg, setPerKg] = useState(entry ? String(entry.dose[1]) : '');
    const [showMono, setShowMono] = useState(false);
    const pick = x => {
      const e = list.find(y => y.id === x);
      setId(x);
      setSi(0);
      setPerKg(e ? String(e.dose[1]) : '');
      setPref({
        lastPaed: x
      });
    };
    if (!entry) return React.createElement("div", {
      className: "dc-card"
    }, React.createElement("div", {
      className: "dc-empty"
    }, "Every paediatric drug is switched off in the library."));
    const w = dv.weight;
    const strength = entry.strengths[si] || entry.strengths[0];
    const r = D.paedDose(entry, w, strength, parseFloat(perKg));
    const color = colorOf(entry.group);
    const freq = {
      1: 'once daily',
      2: '12-hourly (BD)',
      3: '8-hourly (TDS)',
      4: '6-hourly (QDS)',
      6: '4-hourly'
    }[entry.perDay] || entry.perDay + '× daily';
    const lo = entry.dose[0],
      hi = entry.dose[1];
    return React.createElement("div", {
      className: "dc-inf is-two"
    }, React.createElement(DrugPicker, {
      kind: "paed",
      list: list,
      selected: entry.id,
      onPick: pick,
      subtitle: "Paediatric drugs",
      order: (prefs.order || {}).paed || layout.paed,
      groupOrder: (prefs.groups || {}).paed || (layout.groups || {}).paed,
      setOrder: o => setPref({
        order: Object.assign({}, prefs.order, {
          paed: o
        })
      }),
      setGroupOrder: o => setPref({
        groups: Object.assign({}, prefs.groups, {
          paed: o
        })
      }),
      arrange: arrange,
      favs: prefs.favs || [],
      toggleFav: x => setPref({
        favs: (prefs.favs || []).indexOf(x) >= 0 ? prefs.favs.filter(y => y !== x) : [x].concat(prefs.favs || [])
      })
    }), React.createElement("div", {
      className: "dc-col"
    }, React.createElement("div", {
      className: "dc-card dc-rise",
      key: entry.id,
      style: {
        '--g': color
      }
    }, React.createElement("div", {
      className: "dc-drug-head"
    }, React.createElement("span", {
      className: "dc-drug-swatch"
    }), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      className: "dc-drug-title"
    }, entry.name), React.createElement("div", {
      className: "dc-chips"
    }, React.createElement("span", {
      className: "dc-chip"
    }, entry.group), React.createElement("span", {
      className: "dc-chip is-mono"
    }, fmt(lo), hi !== lo ? '–' + fmt(hi) : '', " mg/kg/", entry.mode === 'day' ? 'day' : 'dose'), React.createElement("span", {
      className: "dc-chip"
    }, freq), React.createElement(ReviewChip, {
      e: entry
    })))), React.createElement("div", {
      className: "dc-card-b"
    }, React.createElement("div", {
      className: "dc-label-row"
    }, "Strength"), React.createElement("div", {
      className: "dc-conc"
    }, entry.strengths.map((s, i) => React.createElement("button", {
      key: i,
      className: 'dc-conc-chip' + (si === i ? ' is-on' : ''),
      onClick: () => setSi(i)
    }, React.createElement("b", null, s.label), React.createElement("span", null, s.form ? s.form === 'tab' ? 'tablet' : 'capsule' : fmt(s.mg / s.ml) + ' mg/mL')))), React.createElement("div", {
      className: "dc-io"
    }, React.createElement("div", {
      className: "dc-io-in"
    }, React.createElement("div", {
      className: "dc-label-row"
    }, "mg/kg per ", entry.mode === 'day' ? 'day' : 'dose'), React.createElement("div", {
      className: "dc-big-in"
    }, React.createElement("button", {
      className: "dc-step-big",
      onClick: () => setPerKg(String(Math.max(0, D.round((parseFloat(perKg) || 0) - (hi - lo > 4 ? 1 : 0.5), 2))))
    }, "\u2212"), React.createElement("input", {
      className: "dc-big-num",
      type: "number",
      step: "any",
      min: "0",
      value: perKg,
      onChange: e => setPerKg(e.target.value),
      "aria-label": "mg per kg"
    }), React.createElement("button", {
      className: "dc-step-big",
      onClick: () => setPerKg(String(D.round((parseFloat(perKg) || 0) + (hi - lo > 4 ? 1 : 0.5), 2)))
    }, "+")), hi > lo ? React.createElement("input", {
      type: "range",
      className: "dc-range",
      min: lo,
      max: hi,
      step: (hi - lo) / 20,
      value: parseFloat(perKg) || lo,
      onChange: e => setPerKg(e.target.value),
      style: {
        '--g': color
      }
    }) : null, React.createElement("div", {
      className: "dc-fhint"
    }, "Range ", fmt(lo), hi !== lo ? '–' + fmt(hi) : '', " mg/kg", entry.maxDose ? ' · max ' + fmt(entry.maxDose) + ' mg/dose' : '', entry.maxDay ? ' · max ' + fmt(entry.maxDay) + ' mg/day' : '', entry.maxDayPerKg ? ' (' + entry.maxDayPerKg + ' mg/kg/day)' : '')), React.createElement("div", {
      className: 'dc-result is-' + (!r ? 'none' : r.outOfRange ? 'high' : 'ok')
    }, !w ? React.createElement("div", {
      className: "dc-need"
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 18
    }), " Enter the child's weight in the patient bar.") : React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dc-result-k"
    }, "Each dose (", freq, ")"), React.createElement("div", {
      className: "dc-result-v"
    }, r.volume != null ? React.createElement(React.Fragment, null, React.createElement(Tween, {
      value: r.volume
    }), React.createElement("small", null, " mL")) : r.units != null ? React.createElement(React.Fragment, null, React.createElement(Tween, {
      value: r.units,
      dp: 2
    }), React.createElement("small", null, " ", strength.form === 'cap' ? 'capsule(s)' : 'tablet(s)')) : React.createElement(React.Fragment, null, React.createElement(Tween, {
      value: r.dose
    }), React.createElement("small", null, " mg"))), React.createElement("div", {
      className: "dc-result-s"
    }, React.createElement("b", null, fmt(r.dose), " mg"), " per dose \xB7 ", fmt(r.day), " mg/day for ", fmt(w, 1), " kg"), r.units != null && Math.abs(r.units * 4 - Math.round(r.units * 4)) > 0.05 ? React.createElement("div", {
      className: "dc-result-s"
    }, "Not a whole/half/quarter tablet \u2014 a liquid form may be better.") : null, r.capped ? React.createElement("div", {
      className: "dc-banner is-amber"
    }, "Capped at the ", r.capped === 'dose' ? 'maximum single dose' : 'maximum daily dose', " \u2014 the mg/kg figure would give more.") : null, r.outOfRange ? React.createElement("div", {
      className: "dc-banner is-amber"
    }, fmt(r.mgPerKg), " mg/kg is outside the usual ", fmt(lo), "\u2013", fmt(hi), " mg/kg.") : null))), r && r.volume != null ? React.createElement("div", {
      className: "dc-oral-wrap"
    }, React.createElement(OralSyringe, {
      ml: r.volume,
      color: color
    }), React.createElement("span", null, "Draw up ", React.createElement("b", null, fmt(r.volume), " mL"), " of ", strength.label)) : null, entry.notes ? React.createElement("div", {
      className: "dc-note"
    }, entry.notes) : null, React.createElement("div", {
      className: "dc-src"
    }, "Source: ", entry.source), React.createElement("div", {
      className: "dc-actions"
    }, React.createElement("button", {
      style: MK.btnGhost,
      onClick: () => setShowMono(!showMono)
    }, React.createElement(Svg, {
      d: IC.book,
      s: 14
    }), " ", showMono ? 'Hide' : 'Show', " monograph")))), showMono ? React.createElement(MonographPanel, {
      query: entry.name
    }) : null));
  }
  const CALC_META = {
    body: 'Body size',
    renal: 'Renal function',
    fluids: 'Maintenance fluids',
    drip: 'IV drip rate & pump',
    sodium: 'Sodium correction',
    freewater: 'Free-water deficit',
    electrolytes: 'Corrections & gaps',
    parkland: 'Burns — Parkland',
    convert: 'Unit converter'
  };
  function useLocal(init) {
    const [s, set] = useState(init);
    return [s, (k, v) => set(o => Object.assign({}, o, {
      [k]: v
    }))];
  }
  const Out = ({
    k,
    v,
    unit,
    strong,
    hint
  }) => React.createElement("div", {
    className: 'dc-out' + (strong ? ' is-strong' : '')
  }, React.createElement("span", null, k), React.createElement("b", null, v == null || typeof v === 'number' && !Number.isFinite(v) ? '—' : typeof v === 'number' ? React.createElement(Tween, {
    value: v
  }) : v, unit && v != null ? React.createElement("small", null, " ", unit) : null), hint ? React.createElement("i", null, hint) : null);
  function CalcCard({
    id,
    p,
    dv,
    handle
  }) {
    const w = dv.weight;
    const body = (() => {
      if (id === 'body') return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: "Ideal body weight (Devine)",
        v: dv.ibw,
        unit: "kg",
        strong: true
      }), React.createElement(Out, {
        k: "Adjusted body weight",
        v: dv.adj,
        unit: "kg",
        hint: "IBW + 0.4 \xD7 (actual \u2212 IBW)"
      }), React.createElement(Out, {
        k: "BMI",
        v: dv.bmi,
        unit: "kg/m\xB2",
        hint: dv.bmi ? dv.bmi < 18.5 ? 'underweight' : dv.bmi < 25 ? 'normal' : dv.bmi < 30 ? 'overweight' : 'obese' : ''
      }), React.createElement(Out, {
        k: "BSA (Mosteller)",
        v: dv.bsa,
        unit: "m\xB2",
        hint: "\u221A(height \xD7 weight / 3600)"
      })), React.createElement("div", {
        className: "dc-fhint"
      }, "From the patient bar (weight, height, sex)."));
      if (id === 'renal') {
        const sch = D.schwartzBedside(p.height, p.scr, p.scrUnit);
        const band = v => v == null ? '' : v >= 90 ? 'G1 normal' : v >= 60 ? 'G2 mild' : v >= 45 ? 'G3a' : v >= 30 ? 'G3b' : v >= 15 ? 'G4 severe' : 'G5 kidney failure';
        return React.createElement(React.Fragment, null, React.createElement("div", {
          className: "dc-outs"
        }, React.createElement(Out, {
          k: "CrCl (Cockcroft\u2013Gault)",
          v: dv.crcl,
          unit: "mL/min",
          strong: true,
          hint: 'with ' + (p.basis === 'actual' ? 'actual' : 'adjusted') + ' weight — the figure drug labels use'
        }), React.createElement(Out, {
          k: "eGFR (CKD-EPI 2021)",
          v: dv.egfr,
          unit: "mL/min/1.73m\xB2",
          hint: band(dv.egfr)
        }), !dv.adult ? React.createElement(Out, {
          k: "Bedside Schwartz (child)",
          v: sch,
          unit: "mL/min/1.73m\xB2"
        }) : null), React.createElement("div", {
          className: "dc-fhint"
        }, "Needs age, sex, weight and creatinine in the patient bar."));
      }
      if (id === 'fluids') {
        const m = D.maintenance421(w);
        return React.createElement("div", {
          className: "dc-outs"
        }, React.createElement(Out, {
          k: "Maintenance (4-2-1)",
          v: m && m.mlPerHour,
          unit: "mL/h",
          strong: true
        }), React.createElement(Out, {
          k: "Per day (100/50/20)",
          v: m && m.mlPerDay,
          unit: "mL/day"
        }), React.createElement(Out, {
          k: "Bolus 10 / 20 mL/kg",
          v: w ? fmt(w * 10, 0) + ' / ' + fmt(w * 20, 0) : null,
          unit: "mL"
        }));
      }
      return null;
    })();
    return React.createElement("div", {
      className: "dc-card dc-calc dc-rise"
    }, React.createElement("div", {
      className: "dc-card-h"
    }, handle, React.createElement("b", null, CALC_META[id])), React.createElement("div", {
      className: "dc-card-b"
    }, body || React.createElement(CalcForm, {
      id: id,
      p: p,
      dv: dv
    })));
  }
  function CalcForm({
    id,
    p,
    dv
  }) {
    const w = dv.weight;
    const [s, set] = useLocal({
      vol: '1000',
      hours: '8',
      minutes: '',
      df: '20',
      fluid: 'NS 0.9%',
      na: '',
      target: '',
      glucose: '',
      gUnit: 'mmol',
      ca: '',
      alb: '',
      caUnit: 'mmol',
      cl: '',
      hco3: '',
      sbp: '',
      dbp: '',
      tbsa: '',
      cv: '1',
      cfrom: 'mg',
      cto: 'mcg',
      ratio: '1000',
      pct: '1',
      change: '8'
    });
    if (id === 'drip') {
      const mins = s.minutes ? parseFloat(s.minutes) : parseFloat(s.hours) * 60;
      const d = D.dripRate(s.vol, mins, s.df);
      return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-form"
      }, React.createElement(Field, {
        label: "Volume (mL)"
      }, React.createElement(NumIn, {
        value: s.vol,
        onChange: v => set('vol', v)
      })), React.createElement(Field, {
        label: "Over (hours)"
      }, React.createElement(NumIn, {
        value: s.hours,
        onChange: v => {
          set('hours', v);
          set('minutes', '');
        }
      })), React.createElement(Field, {
        label: "Giving set"
      }, React.createElement("select", {
        className: "inp",
        value: s.df,
        onChange: e => set('df', e.target.value)
      }, React.createElement("option", {
        value: "10"
      }, "10 gtt/mL (blood)"), React.createElement("option", {
        value: "15"
      }, "15 gtt/mL"), React.createElement("option", {
        value: "20"
      }, "20 gtt/mL (standard)"), React.createElement("option", {
        value: "60"
      }, "60 gtt/mL (micro)"))), React.createElement(Field, {
        label: "Fluid"
      }, React.createElement("select", {
        className: "inp",
        value: s.fluid,
        onChange: e => set('fluid', e.target.value)
      }, Object.keys(D.FLUID_NA).map(f => React.createElement("option", {
        key: f
      }, f))))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: "Drip rate",
        v: d && d.dropsPerMin,
        unit: "drops/min",
        strong: true,
        hint: d ? '≈ 1 drop every ' + fmt(60 / d.dropsPerMin, 1) + ' s' : ''
      }), React.createElement(Out, {
        k: "Pump rate",
        v: d && d.mlPerHour,
        unit: "mL/h"
      })), d ? React.createElement(window.DosePumps.InfusionPump, {
        fluid: s.fluid,
        color: "#7cc6ec",
        rate: D.roundToPump(d.mlPerHour),
        volume: parseFloat(s.vol),
        dropFactor: parseFloat(s.df),
        level: null,
        step: 1,
        maxRate: Math.max(500, d.mlPerHour * 2),
        onRate: r => {
          if (r > 0) set('minutes', String(D.round(parseFloat(s.vol) / r * 60, 2)));
        }
      }) : null);
    }
    if (id === 'sodium') {
      const def = D.sodiumDeficit({
        weight: w,
        sex: p.sex,
        age: p.age,
        na: s.na,
        target: s.target
      });
      const am = D.adrogueMadias({
        weight: w,
        sex: p.sex,
        age: p.age,
        na: s.na,
        infusateNa: D.FLUID_NA[s.fluid],
        infusateK: 0,
        targetChange: s.change
      });
      return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-form"
      }, React.createElement(Field, {
        label: "Serum Na (mmol/L)"
      }, React.createElement(NumIn, {
        value: s.na,
        onChange: v => set('na', v),
        placeholder: "e.g. 118"
      })), React.createElement(Field, {
        label: "Target Na"
      }, React.createElement(NumIn, {
        value: s.target,
        onChange: v => set('target', v),
        placeholder: "e.g. 126"
      })), React.createElement(Field, {
        label: "Fluid"
      }, React.createElement("select", {
        className: "inp",
        value: s.fluid,
        onChange: e => set('fluid', e.target.value)
      }, Object.keys(D.FLUID_NA).map(f => React.createElement("option", {
        key: f
      }, f)))), React.createElement(Field, {
        label: "Rise wanted in 24 h"
      }, React.createElement(NumIn, {
        value: s.change,
        onChange: v => set('change', v)
      }))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: "Sodium deficit",
        v: def,
        unit: "mmol",
        strong: true,
        hint: 'TBW ' + fmt(D.tbw(w, p.sex, p.age), 1) + ' L'
      }), React.createElement(Out, {
        k: '1 L of ' + s.fluid + ' changes Na by',
        v: am && am.perLitre,
        unit: "mmol/L",
        hint: "Adrogu\xE9\u2013Madias"
      }), React.createElement(Out, {
        k: 'Litres for +' + (s.change || 0) + ' mmol/L',
        v: am && am.litresForTarget,
        unit: "L"
      })), React.createElement("div", {
        className: "dc-banner is-amber"
      }, "Chronic hyponatraemia: raise by no more than 8\u201310 mmol/L in 24 h (osmotic demyelination). Recheck Na every 2\u20134 h."));
    }
    if (id === 'freewater') {
      const fw = D.freeWaterDeficit({
        weight: w,
        sex: p.sex,
        age: p.age,
        na: s.na
      });
      return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-form"
      }, React.createElement(Field, {
        label: "Serum Na (mmol/L)"
      }, React.createElement(NumIn, {
        value: s.na,
        onChange: v => set('na', v),
        placeholder: "e.g. 160"
      }))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: "Free-water deficit",
        v: fw != null && fw > 0 ? fw : fw != null ? 0 : null,
        unit: "L",
        strong: true,
        hint: "TBW \xD7 (Na / 140 \u2212 1)"
      }), React.createElement(Out, {
        k: "Replace over 48 h",
        v: fw > 0 ? fw * 1000 / 48 : null,
        unit: "mL/h",
        hint: "plus ongoing losses"
      })), React.createElement("div", {
        className: "dc-banner is-amber"
      }, "Lower Na by no more than 10 mmol/L in 24 h."));
    }
    if (id === 'electrolytes') {
      const cna = D.correctedSodium(s.na, s.glucose, s.gUnit);
      const cca = D.correctedCalcium(s.ca, s.alb, s.caUnit);
      const ag = D.anionGap(s.na, s.cl, s.hco3, s.caUnit === 'mmol' ? parseFloat(s.alb) / 10 : s.alb);
      const map = D.meanArterial(s.sbp, s.dbp);
      return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-form"
      }, React.createElement(Field, {
        label: "Na"
      }, React.createElement(NumIn, {
        value: s.na,
        onChange: v => set('na', v)
      })), React.createElement(Field, {
        label: "Cl"
      }, React.createElement(NumIn, {
        value: s.cl,
        onChange: v => set('cl', v)
      })), React.createElement(Field, {
        label: "HCO\u2083"
      }, React.createElement(NumIn, {
        value: s.hco3,
        onChange: v => set('hco3', v)
      })), React.createElement(Field, {
        label: "Glucose"
      }, React.createElement("div", {
        className: "dc-inline"
      }, React.createElement(NumIn, {
        value: s.glucose,
        onChange: v => set('glucose', v),
        style: {
          width: 70
        }
      }), React.createElement(Seg, {
        small: true,
        value: s.gUnit,
        onChange: v => set('gUnit', v),
        options: [{
          v: 'mmol',
          l: 'mmol/L'
        }, {
          v: 'mg',
          l: 'mg/dL'
        }]
      }))), React.createElement(Field, {
        label: "Calcium"
      }, React.createElement(NumIn, {
        value: s.ca,
        onChange: v => set('ca', v)
      })), React.createElement(Field, {
        label: "Albumin"
      }, React.createElement("div", {
        className: "dc-inline"
      }, React.createElement(NumIn, {
        value: s.alb,
        onChange: v => set('alb', v),
        style: {
          width: 70
        }
      }), React.createElement(Seg, {
        small: true,
        value: s.caUnit,
        onChange: v => set('caUnit', v),
        options: [{
          v: 'mmol',
          l: 'mmol · g/L'
        }, {
          v: 'mg',
          l: 'mg · g/dL'
        }]
      }))), React.createElement(Field, {
        label: "BP (sys / dia)"
      }, React.createElement("div", {
        className: "dc-inline"
      }, React.createElement(NumIn, {
        value: s.sbp,
        onChange: v => set('sbp', v),
        style: {
          width: 64
        }
      }), React.createElement(NumIn, {
        value: s.dbp,
        onChange: v => set('dbp', v),
        style: {
          width: 64
        }
      })))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: "Na corrected for glucose",
        v: cna,
        unit: "mmol/L",
        hint: "+2.4 per 100 mg/dL"
      }), React.createElement(Out, {
        k: "Corrected calcium",
        v: cca,
        unit: s.caUnit === 'mmol' ? 'mmol/L' : 'mg/dL'
      }), React.createElement(Out, {
        k: "Anion gap",
        v: ag && ag.gap,
        unit: "mmol/L",
        hint: ag && ag.corrected != null ? 'albumin-corrected ' + fmt(ag.corrected, 1) : 'normal 8–12'
      }), React.createElement(Out, {
        k: "Mean arterial pressure",
        v: map,
        unit: "mmHg"
      })));
    }
    if (id === 'parkland') {
      const pk = D.parkland(w, s.tbsa);
      return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-form"
      }, React.createElement(Field, {
        label: "Burn area (% TBSA)"
      }, React.createElement(NumIn, {
        value: s.tbsa,
        onChange: v => set('tbsa', v),
        placeholder: "partial + full thickness"
      }))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: "Total in 24 h (RL)",
        v: pk && pk.total,
        unit: "mL",
        strong: true,
        hint: "4 mL \xD7 kg \xD7 %TBSA"
      }), React.createElement(Out, {
        k: "First 8 h (from the burn)",
        v: pk && pk.first8PerHour,
        unit: "mL/h"
      }), React.createElement(Out, {
        k: "Next 16 h",
        v: pk && pk.next16PerHour,
        unit: "mL/h"
      })), React.createElement("div", {
        className: "dc-fhint"
      }, "Titrate to urine output 0.5 mL/kg/h (adult), 1 mL/kg/h (child). Children also need maintenance fluid."));
    }
    if (id === 'convert') {
      const mass = D.convertUnits({
        value: s.cv,
        from: s.cfrom,
        to: s.cto
      });
      return React.createElement(React.Fragment, null, React.createElement("div", {
        className: "dc-form"
      }, React.createElement(Field, {
        label: "Value"
      }, React.createElement(NumIn, {
        value: s.cv,
        onChange: v => set('cv', v)
      })), React.createElement(Field, {
        label: "From"
      }, React.createElement("select", {
        className: "inp",
        value: s.cfrom,
        onChange: e => set('cfrom', e.target.value)
      }, ['g', 'mg', 'mcg', 'ng'].map(x => React.createElement("option", {
        key: x
      }, x)))), React.createElement(Field, {
        label: "To"
      }, React.createElement("select", {
        className: "inp",
        value: s.cto,
        onChange: e => set('cto', e.target.value)
      }, ['g', 'mg', 'mcg', 'ng'].map(x => React.createElement("option", {
        key: x
      }, x))))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: fmt(parseFloat(s.cv)) + ' ' + s.cfrom + ' =',
        v: mass,
        unit: s.cto,
        strong: true
      })), React.createElement("div", {
        className: "dc-form",
        style: {
          marginTop: 6
        }
      }, React.createElement(Field, {
        label: "Ratio 1 :"
      }, React.createElement(NumIn, {
        value: s.ratio,
        onChange: v => set('ratio', v)
      })), React.createElement(Field, {
        label: "Percent %"
      }, React.createElement(NumIn, {
        value: s.pct,
        onChange: v => set('pct', v)
      }))), React.createElement("div", {
        className: "dc-outs"
      }, React.createElement(Out, {
        k: '1:' + (s.ratio || '?') + ' =',
        v: D.convertUnits({
          kind: 'ratio',
          value: s.ratio
        }),
        unit: "mg/mL",
        hint: "1:1000 adrenaline = 1 mg/mL"
      }), React.createElement(Out, {
        k: (s.pct || '?') + '% =',
        v: D.convertUnits({
          kind: 'percent',
          value: s.pct
        }),
        unit: "mg/mL",
        hint: "% w/v = g per 100 mL"
      })));
    }
    return null;
  }
  function CalcsTab({
    p,
    dv,
    prefs,
    layout,
    setPref,
    arrange
  }) {
    const ids = D.applyOrder(LIB.CALCS.map(id => ({
      id
    })), prefs.calcs || layout.calcs).map(x => x.id);
    return React.createElement(Sortable, {
      items: ids.map(id => ({
        id
      })),
      getKey: x => x.id,
      enabled: arrange,
      className: "dc-calcs",
      onMove: (a, b) => setPref({
        calcs: D.moveItem(ids, a, b)
      }),
      render: (x, handle) => React.createElement(CalcCard, {
        id: x.id,
        p: p,
        dv: dv,
        handle: handle
      })
    });
  }
  const KIND_LABEL = {
    infusion: 'ICU infusions',
    emergency: 'Emergency',
    paed: 'Paediatric'
  };
  function blankEntry(kind) {
    if (kind === 'infusion') return {
      name: '',
      group: 'Insulin, heparin & others',
      unit: 'mg/h',
      conc: [{
        label: 'Standard',
        amount: '',
        unit: 'mg',
        ml: 50
      }],
      ampoule: {
        amount: '',
        unit: 'mg',
        ml: '',
        label: ''
      },
      diluent: 'NS',
      soft: ['', ''],
      hard: '',
      start: '',
      step: '',
      highAlert: false,
      notes: '',
      source: 'Hospital protocol'
    };
    if (kind === 'emergency') return {
      name: '',
      group: 'Cardiac arrest',
      dose: '',
      unit: 'mg',
      max: '',
      adult: '',
      perMl: '',
      prep: '',
      route: 'IV',
      notes: '',
      source: 'Hospital protocol'
    };
    return {
      name: '',
      group: 'Other',
      mode: 'dose',
      dose: ['', ''],
      perDay: 3,
      maxDose: '',
      maxDay: '',
      strengths: [{
        label: '',
        mg: '',
        ml: 5
      }],
      notes: '',
      source: 'Hospital protocol'
    };
  }
  function LibraryManager({
    lib,
    overrides,
    reload,
    onClose,
    orderSnapshot
  }) {
    const [kind, setKind] = useState('infusion');
    const [q, setQ] = useState('');
    const [sel, setSel] = useState(null);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    const list = lib[kind];
    const entry = sel === '__new' ? null : list.find(e => e.id === sel);
    const ov = overrides.find(o => o.id === sel);
    useEffect(() => {
      setConfirmDel(false);
      if (sel === '__new') {
        setForm(blankEntry(kind));
        return;
      }
      if (!entry) {
        setForm(null);
        return;
      }
      const f = JSON.parse(JSON.stringify(entry));
      ['id', 'kind', 'reviewed', 'builtIn', 'custom', 'disabled', 'overridden'].forEach(k => delete f[k]);
      setForm(f);
    }, [sel, kind]);
    const counts = k => {
      const l = lib[k];
      return {
        all: l.length,
        ok: l.filter(e => e.reviewed.state === 'ok').length,
        stale: l.filter(e => e.reviewed.state === 'stale').length,
        off: l.filter(e => e.disabled).length
      };
    };
    const c = counts(kind);
    const save = () => {
      if (!form || !form.name) {
        toast('A drug name is required.', 'error');
        return;
      }
      setBusy(true);
      const id = sel === '__new' ? 'h-' + kind.slice(0, 3) + '-' + Date.now().toString(36) : sel;
      api.send('PUT', '/api/med/dose-library/' + id, {
        kind,
        data: form,
        disabled: entry ? entry.disabled : false
      }).then(r => {
        setBusy(false);
        if (r && r.ok) {
          toast('Saved — every clinician now calculates from this.');
          reload().then(() => setSel(id));
        } else toast(r && r.error || 'Could not save.', 'error');
      }).catch(() => {
        setBusy(false);
        toast('Could not save.', 'error');
      });
    };
    const toggleOff = () => {
      if (!entry) return;
      setBusy(true);
      api.send('PUT', '/api/med/dose-library/' + entry.id, {
        kind,
        data: ov && ov.data ? ov.data : {},
        disabled: !entry.disabled
      }).then(r => {
        setBusy(false);
        if (r && r.ok) {
          toast(entry.disabled ? 'Switched back on.' : 'Switched off — hidden from the calculator.');
          reload();
        } else toast(r && r.error || 'Could not save.', 'error');
      }).catch(() => setBusy(false));
    };
    const review = clear => {
      setBusy(true);
      api.send('POST', '/api/med/dose-library/' + entry.id + '/review', {
        clear
      }).then(r => {
        setBusy(false);
        if (r && r.ok) {
          toast(clear ? 'Review cleared.' : 'Marked reviewed by ' + (userName() || 'you') + '.');
          reload();
        } else toast(r && r.error || 'Could not record the review.', 'error');
      }).catch(() => setBusy(false));
    };
    const del = () => {
      setBusy(true);
      api.send('DELETE', '/api/med/dose-library/' + entry.id).then(r => {
        setBusy(false);
        if (r && r.ok) {
          toast('Deleted.');
          setSel(null);
          reload();
        } else toast(r && r.error || 'Could not delete.', 'error');
      }).catch(() => setBusy(false));
    };
    const publishOrder = () => {
      setBusy(true);
      api.send('PUT', '/api/med/dose-library/_layout', {
        layout: orderSnapshot()
      }).then(r => {
        setBusy(false);
        if (r && r.ok) {
          toast('Hospital order saved — everyone without their own layout now sees it.');
          reload();
        } else toast(r && r.error || 'Could not save the order.', 'error');
      }).catch(() => setBusy(false));
    };
    const upd = (k, v) => setForm(f => Object.assign({}, f, {
      [k]: v
    }));
    const updArr = (k, i, sub, v) => setForm(f => {
      const a = (f[k] || []).slice();
      a[i] = Object.assign({}, a[i], {
        [sub]: v
      });
      return Object.assign({}, f, {
        [k]: a
      });
    });
    const num = v => v === '' || v == null ? '' : v;
    const term = q.trim().toLowerCase();
    return React.createElement("div", {
      className: "dc-modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Dose library",
      onClick: e => {
        if (e.target === e.currentTarget) onClose();
      }
    }, React.createElement("div", {
      className: "dc-modal-box dc-pop"
    }, React.createElement("div", {
      className: "dc-modal-h"
    }, React.createElement(Svg, {
      d: IC.shield,
      s: 18
    }), React.createElement("b", null, "Dose library"), React.createElement("span", {
      className: "dc-sub"
    }, "Edit, add, switch off and sign off the drugs every clinician calculates from"), React.createElement("button", {
      className: "dc-x",
      onClick: onClose,
      "aria-label": "Close"
    }, React.createElement(Svg, {
      d: IC.x,
      s: 16
    }))), React.createElement("div", {
      className: "dc-modal-tabs"
    }, Object.keys(KIND_LABEL).map(k => React.createElement("button", {
      key: k,
      className: kind === k ? 'is-on' : '',
      onClick: () => {
        setKind(k);
        setSel(null);
      }
    }, KIND_LABEL[k], " ", React.createElement("span", {
      className: "dc-count"
    }, lib[k].length))), React.createElement("span", {
      className: "dc-modal-stats"
    }, React.createElement("span", {
      className: "dc-chip is-green"
    }, c.ok, " reviewed"), React.createElement("span", {
      className: "dc-chip is-amber"
    }, c.all - c.ok - c.stale, " not reviewed"), c.stale ? React.createElement("span", {
      className: "dc-chip is-red"
    }, c.stale, " changed") : null, c.off ? React.createElement("span", {
      className: "dc-chip"
    }, c.off, " off") : null), React.createElement("button", {
      style: MK.btnGhost,
      disabled: busy,
      onClick: publishOrder,
      title: "Save the order you see now (your layout) as the hospital default"
    }, React.createElement(Svg, {
      d: IC.move,
      s: 13
    }), " Publish current order")), React.createElement("div", {
      className: "dc-modal-body"
    }, React.createElement("div", {
      className: "dc-lib-list"
    }, React.createElement("div", {
      className: "dc-search"
    }, React.createElement(Svg, {
      d: IC.search,
      s: 14
    }), React.createElement("input", {
      value: q,
      onChange: e => setQ(e.target.value),
      placeholder: "Search\u2026"
    })), React.createElement("button", {
      className: "dc-lib-add",
      onClick: () => setSel('__new')
    }, React.createElement(Svg, {
      d: IC.plus,
      s: 13
    }), " Add hospital drug"), React.createElement("div", {
      className: "dc-lib-scroll"
    }, list.filter(e => !term || e.name.toLowerCase().indexOf(term) >= 0).map(e => React.createElement("button", {
      key: e.id,
      className: 'dc-lib-row' + (sel === e.id ? ' is-on' : '') + (e.disabled ? ' is-off' : ''),
      onClick: () => setSel(e.id)
    }, React.createElement("i", {
      className: 'dc-dot is-' + (e.reviewed.state === 'ok' ? 'green' : e.reviewed.state === 'stale' ? 'redring' : 'amber')
    }), React.createElement("span", null, e.name), e.custom ? React.createElement("em", null, "hospital") : e.overridden ? React.createElement("em", null, "edited") : null, e.disabled ? React.createElement("em", null, "off") : null)))), React.createElement("div", {
      className: "dc-lib-edit"
    }, !form ? React.createElement("div", {
      className: "dc-empty"
    }, "Pick a drug to edit it or sign it off, or add a hospital drug.", React.createElement("br", null), React.createElement("br", null), "A built-in drug is a default from published references; the green tick appears only after someone here reviews it. Editing a reviewed drug turns it red \u2014 \u201CChanged since review\u201D \u2014 until it is reviewed again.") : React.createElement(React.Fragment, null, entry ? React.createElement("div", {
      className: "dc-chips",
      style: {
        marginBottom: 10
      }
    }, React.createElement(ReviewChip, {
      e: entry
    }), entry.custom ? React.createElement("span", {
      className: "dc-chip"
    }, "hospital-added") : React.createElement("span", {
      className: "dc-chip"
    }, "built-in", entry.overridden ? ' · edited' : ''), entry.disabled ? React.createElement("span", {
      className: "dc-chip is-red"
    }, "switched off") : null) : React.createElement("div", {
      className: "dc-chips",
      style: {
        marginBottom: 10
      }
    }, React.createElement("span", {
      className: "dc-chip is-blue"
    }, "New hospital drug \u2014 ", KIND_LABEL[kind])), React.createElement("div", {
      className: "dc-form"
    }, React.createElement(Field, {
      label: "Name",
      wide: true
    }, React.createElement("input", {
      className: "inp",
      value: form.name || '',
      onChange: e => upd('name', e.target.value)
    })), React.createElement(Field, {
      label: "Group"
    }, React.createElement("input", {
      className: "inp",
      value: form.group || '',
      onChange: e => upd('group', e.target.value),
      list: 'dc-groups-' + kind
    }), React.createElement("datalist", {
      id: 'dc-groups-' + kind
    }, Array.from(new Set(list.map(e => e.group))).map(g => React.createElement("option", {
      key: g,
      value: g
    })))), kind === 'infusion' ? React.createElement(React.Fragment, null, React.createElement(Field, {
      label: "Dose unit"
    }, React.createElement("select", {
      className: "inp",
      value: form.unit,
      onChange: e => upd('unit', e.target.value)
    }, UNIT_CHOICES.map(x => React.createElement("option", {
      key: x
    }, x)))), React.createElement(Field, {
      label: "Usual from"
    }, React.createElement(NumIn, {
      value: num((form.soft || [])[0]),
      onChange: v => upd('soft', [v, (form.soft || [])[1]])
    })), React.createElement(Field, {
      label: "Usual to"
    }, React.createElement(NumIn, {
      value: num((form.soft || [])[1]),
      onChange: v => upd('soft', [(form.soft || [])[0], v])
    })), React.createElement(Field, {
      label: "Hard limit"
    }, React.createElement(NumIn, {
      value: num(form.hard),
      onChange: v => upd('hard', v)
    })), React.createElement(Field, {
      label: "Usual start"
    }, React.createElement(NumIn, {
      value: num(form.start),
      onChange: v => upd('start', v)
    })), React.createElement(Field, {
      label: "Titration step"
    }, React.createElement(NumIn, {
      value: num(form.step),
      onChange: v => upd('step', v)
    })), React.createElement(Field, {
      label: "Dose on"
    }, React.createElement("select", {
      className: "inp",
      value: form.weight || 'actual',
      onChange: e => upd('weight', e.target.value)
    }, React.createElement("option", {
      value: "actual"
    }, "patient's chosen weight"), React.createElement("option", {
      value: "ideal"
    }, "ideal weight (hint)"), React.createElement("option", {
      value: "none"
    }, "not weight-based"))), React.createElement(Field, {
      label: "High-alert"
    }, React.createElement(Seg, {
      small: true,
      value: form.highAlert ? 'y' : 'n',
      onChange: v => upd('highAlert', v === 'y'),
      options: [{
        v: 'y',
        l: 'Yes'
      }, {
        v: 'n',
        l: 'No'
      }]
    })), React.createElement(Field, {
      label: "Diluent"
    }, React.createElement("input", {
      className: "inp",
      value: form.diluent || '',
      onChange: e => upd('diluent', e.target.value)
    }))) : null, kind === 'emergency' ? React.createElement(React.Fragment, null, React.createElement(Field, {
      label: "Dose per kg (or from)"
    }, React.createElement(NumIn, {
      value: num(Array.isArray(form.dose) ? form.dose[0] : form.dose),
      onChange: v => upd('dose', Array.isArray(form.dose) ? [v, form.dose[1]] : v)
    })), React.createElement(Field, {
      label: "\u2026to (range, optional)"
    }, React.createElement(NumIn, {
      value: num(Array.isArray(form.dose) ? form.dose[1] : ''),
      onChange: v => upd('dose', v === '' ? Array.isArray(form.dose) ? form.dose[0] : form.dose : [Array.isArray(form.dose) ? form.dose[0] : form.dose, v])
    })), React.createElement(Field, {
      label: "Unit"
    }, React.createElement("select", {
      className: "inp",
      value: form.unit,
      onChange: e => upd('unit', e.target.value)
    }, ['mg', 'mcg', 'g', 'mmol', 'units', 'mL'].map(x => React.createElement("option", {
      key: x
    }, x)))), React.createElement(Field, {
      label: "Max single dose"
    }, React.createElement(NumIn, {
      value: num(form.max),
      onChange: v => upd('max', v)
    })), React.createElement(Field, {
      label: "Min dose"
    }, React.createElement(NumIn, {
      value: num(form.min),
      onChange: v => upd('min', v)
    })), React.createElement(Field, {
      label: "Adult dose"
    }, React.createElement(NumIn, {
      value: num(form.adult),
      onChange: v => upd('adult', v)
    })), React.createElement(Field, {
      label: "Strength (unit per mL)"
    }, React.createElement(NumIn, {
      value: num(form.perMl),
      onChange: v => upd('perMl', v)
    })), React.createElement(Field, {
      label: "Preparation"
    }, React.createElement("input", {
      className: "inp",
      value: form.prep || '',
      onChange: e => upd('prep', e.target.value)
    })), React.createElement(Field, {
      label: "Route"
    }, React.createElement("input", {
      className: "inp",
      value: form.route || '',
      onChange: e => upd('route', e.target.value)
    }))) : null, kind === 'paed' ? React.createElement(React.Fragment, null, React.createElement(Field, {
      label: "Dose is"
    }, React.createElement(Seg, {
      small: true,
      value: form.mode,
      onChange: v => upd('mode', v),
      options: [{
        v: 'dose',
        l: 'mg/kg/dose'
      }, {
        v: 'day',
        l: 'mg/kg/day'
      }]
    })), React.createElement(Field, {
      label: "mg/kg from"
    }, React.createElement(NumIn, {
      value: num((form.dose || [])[0]),
      onChange: v => upd('dose', [v, (form.dose || [])[1]])
    })), React.createElement(Field, {
      label: "mg/kg to"
    }, React.createElement(NumIn, {
      value: num((form.dose || [])[1]),
      onChange: v => upd('dose', [(form.dose || [])[0], v])
    })), React.createElement(Field, {
      label: "Doses per day"
    }, React.createElement(NumIn, {
      value: num(form.perDay),
      onChange: v => upd('perDay', v)
    })), React.createElement(Field, {
      label: "Max mg/dose"
    }, React.createElement(NumIn, {
      value: num(form.maxDose),
      onChange: v => upd('maxDose', v)
    })), React.createElement(Field, {
      label: "Max mg/day"
    }, React.createElement(NumIn, {
      value: num(form.maxDay),
      onChange: v => upd('maxDay', v)
    })), React.createElement(Field, {
      label: "Max mg/kg/day"
    }, React.createElement(NumIn, {
      value: num(form.maxDayPerKg),
      onChange: v => upd('maxDayPerKg', v)
    }))) : null), kind === 'infusion' ? React.createElement("div", {
      className: "dc-sublist"
    }, React.createElement("div", {
      className: "dc-label-row"
    }, "Concentrations"), (form.conc || []).map((cc, i) => React.createElement("div", {
      key: i,
      className: "dc-inline"
    }, React.createElement("input", {
      className: "inp",
      style: {
        width: 110
      },
      value: cc.label || '',
      onChange: e => updArr('conc', i, 'label', e.target.value),
      placeholder: "label"
    }), React.createElement(NumIn, {
      value: num(cc.amount),
      onChange: v => updArr('conc', i, 'amount', v),
      style: {
        width: 80
      },
      placeholder: "amount"
    }), React.createElement("select", {
      className: "inp",
      value: cc.unit,
      onChange: e => updArr('conc', i, 'unit', e.target.value)
    }, AMOUNT_UNITS.map(x => React.createElement("option", {
      key: x
    }, x))), React.createElement("span", {
      className: "dc-muted"
    }, "in"), React.createElement(NumIn, {
      value: num(cc.ml),
      onChange: v => updArr('conc', i, 'ml', v),
      style: {
        width: 70
      }
    }), React.createElement("span", {
      className: "dc-muted"
    }, "mL"), React.createElement("button", {
      className: "dc-mv",
      onClick: () => upd('conc', form.conc.filter((_, j) => j !== i)),
      "aria-label": "Remove"
    }, React.createElement(Svg, {
      d: IC.x,
      s: 11
    })))), React.createElement("button", {
      className: "dc-link",
      onClick: () => upd('conc', (form.conc || []).concat([{
        label: '',
        amount: '',
        unit: 'mg',
        ml: 50
      }]))
    }, "+ Add concentration"), React.createElement("div", {
      className: "dc-label-row",
      style: {
        marginTop: 8
      }
    }, "Stock ampoule / vial"), React.createElement("div", {
      className: "dc-inline"
    }, React.createElement(NumIn, {
      value: num((form.ampoule || {}).amount),
      onChange: v => upd('ampoule', Object.assign({}, form.ampoule, {
        amount: v
      })),
      style: {
        width: 80
      },
      placeholder: "amount"
    }), React.createElement("select", {
      className: "inp",
      value: (form.ampoule || {}).unit || 'mg',
      onChange: e => upd('ampoule', Object.assign({}, form.ampoule, {
        unit: e.target.value
      }))
    }, AMOUNT_UNITS.map(x => React.createElement("option", {
      key: x
    }, x))), React.createElement("span", {
      className: "dc-muted"
    }, "in"), React.createElement(NumIn, {
      value: num((form.ampoule || {}).ml),
      onChange: v => upd('ampoule', Object.assign({}, form.ampoule, {
        ml: v
      })),
      style: {
        width: 70
      }
    }), React.createElement("span", {
      className: "dc-muted"
    }, "mL"), React.createElement("input", {
      className: "inp",
      style: {
        flex: 1,
        minWidth: 120
      },
      value: (form.ampoule || {}).label || '',
      onChange: e => upd('ampoule', Object.assign({}, form.ampoule, {
        label: e.target.value
      })),
      placeholder: "label, e.g. 4 mg / 4 mL ampoule"
    }))) : null, kind === 'paed' ? React.createElement("div", {
      className: "dc-sublist"
    }, React.createElement("div", {
      className: "dc-label-row"
    }, "Strengths"), (form.strengths || []).map((st, i) => React.createElement("div", {
      key: i,
      className: "dc-inline"
    }, React.createElement("input", {
      className: "inp",
      style: {
        width: 180
      },
      value: st.label || '',
      onChange: e => updArr('strengths', i, 'label', e.target.value),
      placeholder: "e.g. Suspension 125 mg/5 mL"
    }), React.createElement(NumIn, {
      value: num(st.mg),
      onChange: v => updArr('strengths', i, 'mg', v),
      style: {
        width: 70
      }
    }), React.createElement("span", {
      className: "dc-muted"
    }, "mg in"), st.form ? React.createElement("span", {
      className: "dc-muted"
    }, "1 ", st.form) : React.createElement(React.Fragment, null, React.createElement(NumIn, {
      value: num(st.ml),
      onChange: v => updArr('strengths', i, 'ml', v),
      style: {
        width: 60
      }
    }), React.createElement("span", {
      className: "dc-muted"
    }, "mL")), React.createElement("button", {
      className: "dc-mv",
      onClick: () => upd('strengths', form.strengths.filter((_, j) => j !== i)),
      "aria-label": "Remove"
    }, React.createElement(Svg, {
      d: IC.x,
      s: 11
    })))), React.createElement("button", {
      className: "dc-link",
      onClick: () => upd('strengths', (form.strengths || []).concat([{
        label: '',
        mg: '',
        ml: 5
      }]))
    }, "+ Add liquid strength"), React.createElement("button", {
      className: "dc-link",
      onClick: () => upd('strengths', (form.strengths || []).concat([{
        label: '',
        mg: '',
        form: 'tab'
      }]))
    }, "+ Add tablet")) : null, React.createElement("div", {
      className: "dc-form",
      style: {
        marginTop: 8
      }
    }, React.createElement(Field, {
      label: "Notes (shown under the result)",
      wide: true
    }, React.createElement("textarea", {
      className: "inp",
      rows: 3,
      value: form.notes || '',
      onChange: e => upd('notes', e.target.value)
    })), React.createElement(Field, {
      label: "Source / protocol",
      wide: true
    }, React.createElement("input", {
      className: "inp",
      value: form.source || '',
      onChange: e => upd('source', e.target.value)
    }))), React.createElement("div", {
      className: "dc-actions"
    }, React.createElement("button", {
      style: MK.btnPri,
      disabled: busy,
      onClick: save
    }, React.createElement(Svg, {
      d: IC.save,
      s: 14
    }), " Save"), entry ? React.createElement(React.Fragment, null, React.createElement("button", {
      style: MK.btnTone('#1f9d57'),
      disabled: busy,
      onClick: () => review(false),
      title: "Sign off this exact content as checked against hospital protocol"
    }, React.createElement(Svg, {
      d: IC.check,
      s: 14
    }), " Mark reviewed"), entry.reviewed.state !== 'none' ? React.createElement("button", {
      style: MK.btnGhost,
      disabled: busy,
      onClick: () => review(true)
    }, "Clear review") : null, React.createElement("button", {
      style: MK.btnGhost,
      disabled: busy,
      onClick: toggleOff
    }, entry.disabled ? 'Switch on' : 'Switch off'), entry.custom ? confirmDel ? React.createElement("button", {
      style: MK.btnTone('#d23a52'),
      disabled: busy,
      onClick: del
    }, "Confirm delete") : React.createElement("button", {
      style: MK.btnGhost,
      onClick: () => setConfirmDel(true)
    }, "Delete\u2026") : null) : null), React.createElement("div", {
      className: "dc-fhint",
      style: {
        marginTop: 8
      }
    }, "\u201CMark reviewed\u201D signs off what is saved now. Save your edits first, then review."))))));
  }
  function MedDoseCalc() {
    useEffect(() => {
      injectStyle();
    }, []);
    const [overrides, setOverrides] = useState([]);
    const [offline, setOffline] = useState(false);
    const [prefs, setPrefs] = useState(() => readJson(localStorage, PREFS_KEY, {}));
    const [p, setP] = useState(() => Object.assign({
      weight: '',
      height: '',
      age: '',
      sex: 'M',
      scr: '',
      scrUnit: 'umol',
      basis: 'actual',
      name: '',
      uhid: ''
    }, readJson(sessionStorage, PATIENT_KEY, {})));
    const [arrange, setArrange] = useState(false);
    const [libOpen, setLibOpen] = useState(false);
    const [restore, setRestore] = useState(null);
    const [showRecent, setShowRecent] = useState(false);
    const admin = isAdmin();
    const reload = useCallback(() => api.get('/api/med/dose-library').then(r => {
      if (r && r.ok) {
        setOverrides(r.overrides || []);
        setOffline(!!r.offline);
      }
    }).catch(() => setOffline(true)), []);
    useEffect(() => {
      reload();
    }, [reload]);
    useEffect(() => {
      writeJson(sessionStorage, PATIENT_KEY, p);
    }, [p]);
    const setPref = patch => setPrefs(cur => {
      const n = Object.assign({}, cur, patch);
      writeJson(localStorage, PREFS_KEY, n);
      return n;
    });
    const lib = useMemo(() => D.mergeLibrary(LIB, overrides), [overrides]);
    const layoutDoc = overrides.find(o => o.id === '_layout');
    const layout = layoutDoc && layoutDoc.layout || {};
    const dv = derive(p);
    const tabs = D.applyOrder(TABS, prefs.tabs || layout.tabs);
    const tab = tabs.some(t => t.id === prefs.tab) ? prefs.tab : tabs[0].id;
    const tabRef = useRef(null);
    const [ink, setInk] = useState({
      left: 0,
      width: 0
    });
    useLayoutEffect(() => {
      const el = tabRef.current && tabRef.current.querySelector('[data-tab="' + tab + '"]');
      if (el) setInk({
        left: el.offsetLeft,
        width: el.offsetWidth
      });
    }, [tab, tabs.map(t => t.id).join(), arrange]);
    const all = lib.infusion.concat(lib.emergency, lib.paed);
    const reviewed = all.filter(e => e.reviewed.state === 'ok').length;
    const stale = all.filter(e => e.reviewed.state === 'stale').length;
    const pushRecent = r => {
      setPref({
        recent: [Object.assign({
          at: Date.now()
        }, r)].concat((prefs.recent || []).filter(x => x.label !== r.label)).slice(0, 10)
      });
      toast('Saved to recent calculations.');
    };
    const ownLayout = !!(prefs.order || prefs.groups || prefs.tabs || prefs.calcs);
    const orderSnapshot = () => {
      const ord = kind => D.applyOrder(lib[kind], (prefs.order || {})[kind] || layout[kind]).map(e => e.id);
      const grp = kind => {
        const gs = Array.from(new Set(D.applyOrder(lib[kind], (prefs.order || {})[kind] || layout[kind]).map(e => e.group || 'Other')));
        return D.applyOrder(gs.map(g => ({
          id: g
        })), (prefs.groups || {})[kind] || (layout.groups || {})[kind]).map(g => g.id);
      };
      return {
        infusion: ord('infusion'),
        emergency: ord('emergency'),
        paed: ord('paed'),
        groups: {
          infusion: grp('infusion'),
          emergency: grp('emergency'),
          paed: grp('paed')
        },
        calcs: D.applyOrder(LIB.CALCS.map(id => ({
          id
        })), prefs.calcs || layout.calcs).map(x => x.id),
        tabs: tabs.map(t => t.id)
      };
    };
    const common = {
      lib,
      p,
      dv,
      prefs,
      layout,
      setPref,
      arrange,
      admin
    };
    return React.createElement("div", {
      className: "dc-root",
      style: MK.page
    }, React.createElement("div", {
      className: "dc-hero"
    }, React.createElement("div", {
      className: "dc-hero-l"
    }, React.createElement("div", {
      className: "dc-hero-ic"
    }, React.createElement(Svg, {
      d: "M9 3h6M10 3v5l-5.5 9.5A2.5 2.5 0 0 0 6.7 21h10.6a2.5 2.5 0 0 0 2.2-3.5L14 8V3M7.5 15h9",
      s: 22,
      sw: 1.8
    })), React.createElement("div", null, React.createElement("h2", null, "Dose Calculator"), React.createElement("p", null, "ICU infusions, emergency drugs, paediatric doses and bedside formulas \u2014 from one patient's weight."))), React.createElement("div", {
      className: "dc-hero-r"
    }, React.createElement("span", {
      className: 'dc-chip ' + (reviewed === all.length ? 'is-green' : 'is-amber'),
      title: "Library entries signed off by this hospital"
    }, React.createElement(Svg, {
      d: IC.shield,
      s: 11
    }), " ", reviewed, "/", all.length, " reviewed", stale ? ' · ' + stale + ' changed' : ''), offline ? React.createElement("span", {
      className: "dc-chip",
      title: "No database \u2014 built-in list only; edits cannot be saved"
    }, "built-in list (offline)") : null, React.createElement("button", {
      className: 'dc-tbtn' + (showRecent ? ' is-on' : ''),
      onClick: () => setShowRecent(!showRecent),
      disabled: !(prefs.recent || []).length
    }, React.createElement(Svg, {
      d: IC.clock,
      s: 14
    }), " Recent", (prefs.recent || []).length ? ' (' + prefs.recent.length + ')' : ''), React.createElement("button", {
      className: 'dc-tbtn' + (arrange ? ' is-on' : ''),
      onClick: () => setArrange(!arrange),
      title: "Drag drugs, groups, tabs and calculator cards into your own order"
    }, React.createElement(Svg, {
      d: IC.move,
      s: 14
    }), " ", arrange ? 'Done arranging' : 'Arrange'), admin ? React.createElement("button", {
      className: "dc-tbtn",
      onClick: () => setLibOpen(true)
    }, React.createElement(Svg, {
      d: IC.shield,
      s: 14
    }), " Library") : null)), arrange ? React.createElement("div", {
      className: "dc-arrange-bar dc-rise"
    }, React.createElement(Svg, {
      d: IC.move,
      s: 15
    }), React.createElement("span", null, React.createElement("b", null, "Arrange mode"), " \u2014 drag the \u283F handle (or use \u25B2\u25BC) on any drug, group, tab or calculator card. Your order is saved in this browser."), ownLayout ? React.createElement("button", {
      style: MK.btnGhost,
      onClick: () => setPref({
        order: undefined,
        groups: undefined,
        tabs: undefined,
        calcs: undefined
      })
    }, React.createElement(Svg, {
      d: IC.reset,
      s: 13
    }), " Reset to hospital order") : null, admin ? React.createElement("button", {
      style: MK.btnPri,
      disabled: offline,
      onClick: () => api.send('PUT', '/api/med/dose-library/_layout', {
        layout: orderSnapshot()
      }).then(r => {
        if (r && r.ok) {
          toast('Published as the hospital order.');
          reload();
        } else toast(r && r.error || 'Could not save.', 'error');
      })
    }, React.createElement(Svg, {
      d: IC.save,
      s: 13
    }), " Publish as hospital order") : null) : null, showRecent && (prefs.recent || []).length ? React.createElement("div", {
      className: "dc-recent dc-rise"
    }, (prefs.recent || []).map((r, i) => React.createElement("button", {
      key: i,
      className: "dc-recent-chip",
      onClick: () => {
        if (r.weight) setP(Object.assign({}, p, {
          weight: String(r.weight)
        }));
        setPref({
          tab: 'infusion'
        });
        setRestore(Object.assign({}, r, {
          n: Date.now()
        }));
        setShowRecent(false);
      }
    }, React.createElement("b", null, r.label), React.createElement("span", null, r.weight ? r.weight + ' kg · ' : '', new Date(r.at).toLocaleString([], {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })))), React.createElement("button", {
      className: "dc-link",
      onClick: () => {
        setPref({
          recent: []
        });
        setShowRecent(false);
      }
    }, "Clear")) : null, React.createElement(PatientBar, {
      p: p,
      set: setP,
      dv: dv
    }), React.createElement("div", {
      className: "dc-tabs-wrap",
      ref: tabRef
    }, React.createElement(Sortable, {
      items: tabs,
      getKey: t => t.id,
      enabled: arrange,
      axis: "x",
      className: "dc-tabs",
      onMove: (a, b) => setPref({
        tabs: D.moveItem(tabs.map(t => t.id), a, b)
      }),
      render: (t, handle) => React.createElement("button", {
        "data-tab": t.id,
        className: 'dc-tab' + (tab === t.id ? ' is-on' : ''),
        onClick: () => {
          setRestore(null);
          setPref({
            tab: t.id
          });
        }
      }, handle, React.createElement(Svg, {
        d: t.icon,
        s: 15
      }), t.label)
    }), React.createElement("span", {
      className: "dc-ink",
      style: {
        transform: 'translateX(' + ink.left + 'px)',
        width: ink.width
      }
    })), React.createElement("div", {
      className: "dc-pane",
      key: tab
    }, tab === 'infusion' ? React.createElement(InfusionTab, _extends({}, common, {
      restore: restore,
      onRecent: pushRecent
    })) : null, tab === 'emergency' ? React.createElement(EmergencyTab, common) : null, tab === 'paed' ? React.createElement(PaedTab, common) : null, tab === 'calcs' ? React.createElement(CalcsTab, common) : null), React.createElement("div", {
      className: "dc-disclaimer"
    }, React.createElement(Svg, {
      d: IC.alert,
      s: 14
    }), React.createElement("span", null, React.createElement("b", null, "Calculation aid, not a prescription."), " Verify every dose against the written prescription and hospital protocol, and use an independent two-person check for high-alert drugs. Built-in library entries are defaults from published references until reviewed by this hospital.")), libOpen ? React.createElement(LibraryManager, {
      lib: lib,
      overrides: overrides,
      reload: reload,
      onClose: () => setLibOpen(false),
      orderSnapshot: orderSnapshot
    }) : null);
  }
  function injectStyle() {
    if (document.getElementById('dose-calc-style')) return;
    const INK = MK.INK,
      MUTED = MK.MUTED,
      FAINT = MK.FAINT,
      LINE = MK.LINE,
      MONO = MK.MONO,
      BODY = MK.BODY;
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
    }), medCan('print') && React.createElement("button", {
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
  }, "\u2190 Prescriptions"), medCan('print') && React.createElement("button", {
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
  if (view === 'medCalc') return window.MedDoseCalc ? React.createElement(window.MedDoseCalc, null) : React.createElement(MedCalc, null);
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
  medApi,
  MedMonograph: Monograph,
  MedPregChip: PregChip,
  MedAbxChip: AbxChip
});
})();
