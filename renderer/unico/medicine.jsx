/* UNICO — Medicine & Rx module (renderer).
 *
 * Two jobs, one vocabulary: look a drug up, and write a prescription with it.
 *
 * Views:
 *   medHome       overview — one search box, what the index holds, recent prescriptions
 *   medBrowse     the drug index: filter by class / company / form / letter, paged
 *   medBrand      a brand page — price, alternatives by the same generic, the monograph
 *   medGeneric    a generic page — the full monograph, and every brand that carries it
 *   medRxNew      the prescription pad
 *   medRxList     prescriptions written, searchable by patient / UHID / diagnosis
 *   medRxPrint    the printable A4 prescription
 *   medTemplates  saved drug sets a clinician drops onto the pad in one click
 *   medCatalog    admin: correct a price, a strength, or a monograph
 *
 * WHY SEARCH IS A SERVER CALL AND NOT A LOCAL FILTER
 * The index is 21.7k brands. Every other store in this app is loaded into the browser
 * up front; this one cannot be, so `medApi.search` is debounced and the server answers
 * from an index. That is also why the drug picker never shows "no results" until the
 * request has actually returned — a blank list while typing reads as "we don't stock
 * it", which is the one wrong answer a prescriber must never be given.
 *
 * THE DATA IS A 2022 SNAPSHOT. Prices are labelled as indicative everywhere they are
 * shown, and the printed prescription carries the same note. See server/medicines.js.
 *
 * SAFETY WARNINGS ARE A PROMPT, NOT A GATE. The check reports what the monographs say
 * about drugs prescribed together. It never blocks issuing — it requires the prescriber
 * to acknowledge it, and stores what they were shown alongside the prescription.
 *
 * Data: server/medicines.js (medBrands / medGenerics / medRefs / prescriptions).
 */

const { useState, useEffect, useMemo, useRef, useCallback } = React;
const Ic = window.Ic, I = window.I;
const MK = window.MK;

const medApi = {
  get: (u) => fetch(u, { headers: { accept: 'application/json' } }).then((r) => r.json()),
  put: (u, b) => fetch(u, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  post: (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}) }).then((r) => r.json()),
  del: (u) => fetch(u, { method: 'DELETE' }).then((r) => r.json()),
};
const medToast = (m, t) => { try { window.UI && window.UI.toast && window.UI.toast(m, t || 'success'); } catch (e) {} };
const medCan = (a) => { try { return window.unicoCan ? window.unicoCan('medicine', a) : true; } catch (e) { return true; } };
const medIsAdmin = () => { try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; } };
const qs = (o) => Object.keys(o).filter((k) => o[k] !== '' && o[k] != null).map((k) => k + '=' + encodeURIComponent(o[k])).join('&');
const money = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : '৳ ' + Number(n).toFixed(2));
const today = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s == null ? '' : s);

// The monograph HTML was whitelisted and stripped of every attribute by the importer
// before it ever reached the database (server-side, so the browser cannot be the thing
// that decides it is safe). Rendering it is what makes a dosage table readable.
// Any card that hosts a DrugSearchBox needs two things MK.card denies it.
//   overflow  — MK.card is overflow:hidden, which clips the dropdown at the card edge.
//   z-index   — MK.card uses backdrop-filter, and that creates a STACKING CONTEXT. So a
//               z-index on the dropdown itself can never lift it above the next card
//               down the page; the whole hosting card has to be raised instead, or the
//               results render behind the cards below them.
const cardOpen = (extra) => Object.assign({}, MK.card, { overflow: 'visible', position: 'relative', zIndex: 30 }, extra || {});

const Monograph = ({ html }) => <div className="mono-body" dangerouslySetInnerHTML={{ __html: esc(html) }} />;

const SECTION_LABEL = {
  indication: 'Indications', therapeuticClass: 'Therapeutic class', pharmacology: 'Pharmacology',
  dosage: 'Dosage & administration', adultDose: 'Adult dose', childDose: 'Child dose', renalDose: 'Renal dose',
  administration: 'Administration', interaction: 'Interactions',
  contraindications: 'Contraindications', sideEffects: 'Side effects', pregnancy: 'Pregnancy & lactation',
  precautions: 'Precautions',
  nursingConsiderations: 'Nursing considerations', prescriberConsiderations: 'Prescriber considerations',
  pediatric: 'Paediatric use', overdose: 'Overdose', duration: 'Duration of treatment',
  reconstitution: 'Reconstitution', storage: 'Storage',
};
const SECTION_ORDER = ['indication', 'therapeuticClass', 'pharmacology', 'dosage', 'adultDose', 'childDose', 'renalDose', 'administration', 'interaction', 'contraindications', 'sideEffects', 'pregnancy', 'precautions', 'nursingConsiderations', 'prescriberConsiderations', 'pediatric', 'overdose', 'duration', 'reconstitution', 'storage'];

// Bangladeshi prescribing shorthand. The "1+0+1" form is what is actually written on
// pads here, so it leads; the Latin abbreviations follow for anyone who prefers them.
const FREQ = ['1+0+0', '0+0+1', '1+0+1', '1+1+1', '0+1+0', '1+1+1+1', '½+0+½', 'OD', 'BD', 'TDS', 'QDS', 'SOS', 'STAT', 'Weekly'];
const TIMING = ['After meal', 'Before meal', 'With meal', 'Empty stomach', 'At bedtime', 'As directed'];
const DURATION = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '2 months', '3 months', 'Continue'];

/* ================= shared bits ================= */

function MedEmpty({ icon, title, note, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '46px 20px', color: MK.MUTED }}>
      <div style={{ marginBottom: 10, opacity: .5 }}><Ic d={icon || I.search} s={30} /></div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: MK.INK, marginBottom: 5 }}>{title}</div>
      {note ? <div style={{ fontSize: 12.5, lineHeight: 1.55, maxWidth: 420, margin: '0 auto 14px' }}>{note}</div> : null}
      {action || null}
    </div>
  );
}

// Shown wherever a price appears. The snapshot date is not a footnote — a clinician
// quoting a four-year-old price to a patient is a real problem, so it is said plainly.
const PriceNote = () => (
  <span style={{ fontSize: 10.5, color: MK.FAINT, fontStyle: 'italic' }}>indicative price, 2022 snapshot</span>
);

function TypeChip({ type }) {
  if (type !== 'herbal') return null;
  return <span style={MK.gchip('green')}>Herbal</span>;
}

/* ---- the drug type-ahead, shared by the index and the prescription pad ---- */
function useDrugSearch(q, kind) {
  const [res, setRes] = useState({ brands: [], generics: [], loading: false, done: false });
  const seq = useRef(0);
  useEffect(() => {
    const term = String(q || '').trim();
    if (term.length < 2) { setRes({ brands: [], generics: [], loading: false, done: false }); return; }
    setRes((s) => ({ ...s, loading: true }));
    const mine = ++seq.current;
    const t = setTimeout(() => {
      medApi.get('/api/med/search?' + qs({ q: term, kind: kind || '', limit: 20 })).then((r) => {
        // A slower earlier request must never overwrite a newer one's results, or the
        // list flickers back to what you typed three keystrokes ago.
        if (mine !== seq.current) return;
        setRes({ brands: (r && r.brands) || [], generics: (r && r.generics) || [], loading: false, done: true });
      }).catch(() => { if (mine === seq.current) setRes({ brands: [], generics: [], loading: false, done: true }); });
    }, 220);
    return () => clearTimeout(t);
  }, [q, kind]);
  return res;
}

function DrugSearchBox({ value, onChange, onPick, placeholder, autoFocus, kind }) {
  const [open, setOpen] = useState(false);
  const res = useDrugSearch(value, kind);
  const box = useRef(null);
  useEffect(() => {
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  const hasAny = res.brands.length || res.generics.length;
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: MK.FAINT }}><Ic d={I.search} s={15} /></span>
        <input className="inp" autoFocus={autoFocus} value={value} placeholder={placeholder || 'Search brand or generic — e.g. Napa, Paracetamol, Seclo'}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          style={{ width: '100%', padding: '10px 12px 10px 34px', fontSize: 13 }} />
        {res.loading ? <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: MK.FAINT }}>searching…</span> : null}
      </div>
      {open && String(value || '').trim().length >= 2 ? (
        <div style={{ position: 'absolute', zIndex: 40, top: '100%', left: 0, right: 0, marginTop: 5, maxHeight: 380, overflowY: 'auto', background: '#fff', border: '1px solid ' + MK.LINE, borderRadius: 11, boxShadow: '0 18px 44px rgba(31,59,90,.18)' }}>
          {res.generics.length ? (
            <div style={{ padding: '7px 12px 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: .6, color: MK.FAINT, textTransform: 'uppercase' }}>Generics</div>
          ) : null}
          {res.generics.map((g) => (
            <button key={g.id} className="row-btn" onClick={() => { onPick({ kind: 'generic', doc: g }); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0, background: 'transparent', cursor: 'pointer' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: MK.INK }}>{g.name}</div>
              <div style={{ fontSize: 11, color: MK.MUTED }}>{g.drugClass || 'Generic'} · {g.brands || 0} brand{g.brands === 1 ? '' : 's'}</div>
            </button>
          ))}
          {res.brands.length ? (
            <div style={{ padding: '7px 12px 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: .6, color: MK.FAINT, textTransform: 'uppercase', borderTop: res.generics.length ? '1px solid ' + MK.LINE : 0 }}>Brands</div>
          ) : null}
          {res.brands.map((b) => (
            <button key={b.id} className="row-btn" onClick={() => { onPick({ kind: 'brand', doc: b }); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0, background: 'transparent', cursor: 'pointer' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: MK.INK }}>
                {b.name} <span style={{ fontWeight: 500, color: MK.MUTED }}>{b.strength}</span> <TypeChip type={b.type} />
              </div>
              <div style={{ fontSize: 11, color: MK.MUTED }}>
                {b.form ? b.form + ' · ' : ''}{b.generic}{b.manufacturer ? ' · ' + b.manufacturer : ''}
                {b.price && b.price.unit != null ? ' · ' + money(b.price.unit) : ''}
              </div>
            </button>
          ))}
          {!hasAny && res.done && !res.loading ? (
            <div style={{ padding: '14px 12px', fontSize: 12, color: MK.MUTED, textAlign: 'center' }}>
              Nothing in the index matches “{value}”. It may be a brand registered after the 2022 snapshot — you can still type it onto the pad by hand.
            </div>
          ) : null}
          {!res.done && res.loading ? <div style={{ padding: '14px 12px', fontSize: 12, color: MK.FAINT, textAlign: 'center' }}>Searching the index…</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ================= medHome ================= */
function MedHome({ setRoute }) {
  const [status, setStatus] = useState(null);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    medApi.get('/api/med/status').then(setStatus).catch(() => setStatus({ ready: false }));
    medApi.get('/api/prescriptions?limit=8').then((r) => setRecent((r && r.prescriptions) || [])).catch(() => {});
  }, []);
  const go = (p) => { if (p.kind === 'brand') setRoute({ view: 'medBrand', id: p.doc.id }); else setRoute({ view: 'medGeneric', id: p.doc.id }); };

  if (status && !status.ready) {
    return (
      <div style={MK.page}>
        <div style={MK.card}>
          <MedEmpty icon={I.download} title="The drug index has not been imported yet"
            note="Run the importer once to load the Bangladesh medicine index — about 21,700 brands and 1,700 generic monographs — into this installation."
            action={<code style={{ display: 'inline-block', background: 'rgba(125,145,180,.12)', padding: '9px 14px', borderRadius: 8, fontSize: 12, fontFamily: MK.MONO }}>node scripts/import-medicines.js</code>} />
        </div>
      </div>
    );
  }

  return (
    <div style={MK.page}>
      <div style={cardOpen({ marginBottom: 16 })}>
        <div style={{ padding: '26px 26px 22px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: MK.INK, marginBottom: 4 }}>Medicine &amp; Prescription</div>
          <div style={{ ...MK.sub, marginBottom: 18 }}>
            Look up any brand or generic sold in Bangladesh, read its monograph, and write a prescription from it.
          </div>
          <DrugSearchBox value={q} onChange={setQ} onPick={go} autoFocus
            placeholder="Search 21,700 brands and 1,700 generics — try Napa, Seclo, Amoxicillin…" />
          <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
            <button style={MK.btnPri} onClick={() => setRoute({ view: 'medRxNew' })}><Ic d={I.plus} s={14} />New prescription</button>
            <button style={MK.btnGhost} onClick={() => setRoute({ view: 'medBrowse' })}><Ic d={I.layers} s={14} />Browse the index</button>
            <button style={MK.btnGhost} onClick={() => setRoute({ view: 'medRxList' })}><Ic d={I.doc} s={14} />Prescriptions</button>
            <button style={MK.btnGhost} onClick={() => setRoute({ view: 'medTemplates' })}><Ic d={I.star} s={14} />Templates</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 13, marginBottom: 16 }}>
        {[
          { label: 'Brands indexed', value: status ? (status.brands || 0).toLocaleString() : '—', tone: 'blue' },
          { label: 'Generic monographs', value: status ? (status.generics || 0).toLocaleString() : '—', tone: 'teal' },
          { label: 'Prescriptions written', value: recent.length ? '—' : '0', tone: 'violet', link: 'medRxList' },
          { label: 'Data snapshot', value: '2022', tone: 'amber', note: 'prices indicative' },
        ].map((s, i) => (
          <div key={i} style={{ ...MK.card, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MK.MUTED, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 25, fontWeight: 800, color: MK.INK, fontFamily: MK.MONO }}>{s.value}</div>
            {s.note ? <div style={{ fontSize: 10.5, color: MK.FAINT, marginTop: 3 }}>{s.note}</div> : null}
          </div>
        ))}
      </div>

      <MedQuickRail setRoute={setRoute} />

      <div style={MK.card}>
        <div style={MK.cardHead}>
          <div style={MK.h3}>Recent prescriptions</div>
          <button style={MK.btnGhost} onClick={() => setRoute({ view: 'medRxList' })}>See all</button>
        </div>
        <div style={MK.cardBody}>
          {recent.length ? <RxRows rows={recent} setRoute={setRoute} /> : (
            <MedEmpty icon={I.doc} title="No prescriptions yet"
              note="Prescriptions you write are stored against the patient's UHID so you can pull up their history and repeat one."
              action={<button style={MK.btnPri} onClick={() => setRoute({ view: 'medRxNew' })}>Write the first one</button>} />
          )}
        </div>
      </div>
    </div>
  );
}

// Saved and recently-viewed drugs. A prescriber returns to the same handful of drugs
// all day, and 21.7k rows is a lot to search through for the fifth time this morning.
function MedQuickRail({ setRoute }) {
  const fav = useFavourites();
  const [recent, setRecent] = useState(() => readLS(RECENT_KEY, []));
  useEffect(() => { setRecent(readLS(RECENT_KEY, [])); }, []);
  const go = (e) => setRoute({ view: e.kind === 'brand' ? 'medBrand' : 'medGeneric', id: e.id });
  const Row = ({ items, empty }) => (
    items.length ? (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map((e) => (
          <button key={e.kind + e.id} onClick={() => go(e)}
            style={{ textAlign: 'left', padding: '8px 12px', border: '1px solid ' + MK.LINE, borderRadius: 10, background: '#fff', cursor: 'pointer' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: MK.INK }}>{e.name}</div>
            <div style={{ fontSize: 10.5, color: MK.MUTED }}>{e.sub || e.kind}</div>
          </button>
        ))}
      </div>
    ) : <div style={{ fontSize: 12, color: MK.FAINT }}>{empty}</div>
  );
  if (!fav.favs.length && !recent.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 13, marginBottom: 16 }}>
      <div style={MK.card}>
        <div style={MK.cardHead}><div style={MK.h3}>Saved drugs</div></div>
        <div style={MK.cardBody}><Row items={fav.favs.slice(0, 10)} empty="Star a drug on its page to keep it here." /></div>
      </div>
      <div style={MK.card}>
        <div style={MK.cardHead}><div style={MK.h3}>Recently viewed</div></div>
        <div style={MK.cardBody}><Row items={recent.slice(0, 10)} empty="Drugs you open appear here." /></div>
      </div>
    </div>
  );
}

/* ================= medBrowse — the drug index ================= */
function MedBrowse({ setRoute, initialQ }) {
  const [kind, setKind] = useState('brand');
  const [q, setQ] = useState(initialQ || '');
  const [filters, setFilters] = useState({ letter: '', class: '', mfr: '', form: '', type: '', stocked: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, pages: 0, loading: true });
  const [refs, setRefs] = useState({ class: [], mfr: [], form: [] });
  const search = useDrugSearch(q, kind);

  useEffect(() => {
    Promise.all([
      medApi.get('/api/med/refs?kind=class'), medApi.get('/api/med/refs?kind=mfr'), medApi.get('/api/med/refs?kind=form'),
    ]).then(([c, m, f]) => setRefs({ class: (c && c.refs) || [], mfr: (m && m.refs) || [], form: (f && f.refs) || [] })).catch(() => {});
  }, []);

  useEffect(() => {
    if (String(q || '').trim().length >= 2) return;   // the search results take over
    setData((d) => ({ ...d, loading: true }));
    medApi.get('/api/med/browse?' + qs({ kind, page, per: 50, ...filters }))
      .then((r) => setData({ rows: (r && r.rows) || [], total: (r && r.total) || 0, pages: (r && r.pages) || 0, loading: false }))
      .catch(() => setData({ rows: [], total: 0, pages: 0, loading: false }));
  }, [kind, page, filters, q]);

  useEffect(() => { setPage(1); }, [kind, filters]);
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v }));
  const searching = String(q || '').trim().length >= 2;
  const rows = searching ? (kind === 'generic' ? search.generics : search.brands) : data.rows;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div style={MK.page}>
      <div style={cardOpen({ marginBottom: 14 })}>
        <div style={{ padding: '18px 20px 16px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 13, flexWrap: 'wrap' }}>
            {[['brand', 'Brands'], ['generic', 'Generics']].map(([k, label]) => (
              <button key={k} onClick={() => setKind(k)}
                style={kind === k ? MK.btnPri : MK.btnGhost}>{label}</button>
            ))}
            <div style={{ flex: 1, minWidth: 240 }}>
              <DrugSearchBox value={q} onChange={setQ} kind={kind}
                onPick={(p) => setRoute(p.kind === 'brand' ? { view: 'medBrand', id: p.doc.id } : { view: 'medGeneric', id: p.doc.id })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 11 }}>
            <button onClick={() => setF('letter', '')} style={{ ...MK.btnGhost, padding: '4px 9px', fontSize: 11, background: filters.letter ? undefined : 'rgba(0,144,202,.12)' }}>All</button>
            {LETTERS.map((L) => (
              <button key={L} onClick={() => setF('letter', L.toLowerCase())}
                style={{ ...MK.btnGhost, padding: '4px 8px', fontSize: 11, minWidth: 26, justifyContent: 'center', background: filters.letter === L.toLowerCase() ? 'rgba(0,144,202,.16)' : undefined }}>{L}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 9 }}>
            <select className="inp" value={filters.class} onChange={(e) => setFilters((f) => ({ ...f, class: e.target.value }))} style={{ fontSize: 12 }}>
              <option value="">All drug classes</option>
              {refs.class.map((r) => <option key={r.id} value={r.name}>{r.name} ({r.count})</option>)}
            </select>
            {kind === 'brand' ? (
              <select className="inp" value={filters.mfr} onChange={(e) => setFilters((f) => ({ ...f, mfr: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="">All manufacturers</option>
                {refs.mfr.map((r) => <option key={r.id} value={r.name}>{r.name} ({r.count})</option>)}
              </select>
            ) : null}
            {kind === 'brand' ? (
              <select className="inp" value={filters.form} onChange={(e) => setFilters((f) => ({ ...f, form: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="">All dosage forms</option>
                {refs.form.map((r) => <option key={r.id} value={r.name}>{r.name} ({r.count})</option>)}
              </select>
            ) : null}
            {kind === 'brand' ? (
              <select className="inp" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="">Allopathic &amp; herbal</option>
                <option value="allopathic">Allopathic only</option>
                <option value="herbal">Herbal only</option>
              </select>
            ) : null}
            {kind === 'brand' ? (
              <select className="inp" value={filters.stocked} onChange={(e) => setFilters((f) => ({ ...f, stocked: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="">Whole index</option>
                <option value="1">Only what we stock</option>
              </select>
            ) : null}
          </div>
        </div>
      </div>

      <div style={MK.card}>
        <div style={MK.cardHead}>
          <div style={MK.h3}>
            {searching ? 'Search results' : (kind === 'generic' ? 'Generics' : 'Brands')}
            {!searching && data.total ? <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}> · {data.total.toLocaleString()} found</span> : null}
          </div>
          {!searching && data.pages > 1 ? (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <button style={MK.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <span style={{ fontSize: 12, color: MK.MUTED, fontFamily: MK.MONO }}>{page} / {data.pages}</span>
              <button style={MK.btnGhost} disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          ) : null}
        </div>
        <div style={{ overflowX: 'auto' }}>
          {data.loading && !searching ? <div style={{ padding: 34, textAlign: 'center', color: MK.FAINT, fontSize: 12.5 }}>Loading the index…</div> : null}
          {!data.loading || searching ? (
            rows.length ? (
              <table className="tbl" style={{ width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>{kind === 'generic' ? 'Generic' : 'Brand'}</th>
                    {kind === 'brand' ? <th style={{ textAlign: 'left' }}>Strength</th> : null}
                    {kind === 'brand' ? <th style={{ textAlign: 'left' }}>Form</th> : null}
                    <th style={{ textAlign: 'left' }}>{kind === 'generic' ? 'Class' : 'Generic'}</th>
                    <th style={{ textAlign: 'left' }}>{kind === 'generic' ? 'Brands' : 'Manufacturer'}</th>
                    <th style={{ textAlign: 'right' }}>{kind === 'generic' ? 'Forms' : 'Unit price'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }}
                      onClick={() => setRoute(kind === 'generic' ? { view: 'medGeneric', id: r.id } : { view: 'medBrand', id: r.id })}>
                      <td style={{ fontWeight: 700, color: MK.INK }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                          {kind === 'brand' ? <DrugImage brand={r} size={30} /> : null}
                          <span>{r.name} <TypeChip type={r.type} /> <StockChip brand={r} /> <PregChip cat={r.pregnancyCategory} /></span>
                        </span>
                      </td>
                      {kind === 'brand' ? <td style={{ fontFamily: MK.MONO, fontSize: 11.5 }}>{r.strength || '—'}</td> : null}
                      {kind === 'brand' ? <td>{r.form || '—'}</td> : null}
                      <td style={{ color: MK.MUTED }}>{kind === 'generic' ? (r.drugClass || '—') : (r.generic || '—')}</td>
                      <td style={{ color: MK.MUTED }}>{kind === 'generic' ? (r.brands || 0) : (r.manufacturer || '—')}</td>
                      <td style={{ textAlign: 'right', fontFamily: MK.MONO, fontSize: 11.5 }}>
                        {kind === 'generic' ? ((r.forms || []).slice(0, 2).join(', ') || '—') : money(r.price && r.price.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <MedEmpty title="Nothing matches these filters" note="Try clearing a filter, or search by name above." />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ================= monograph rendering ================= */
function MonographSections({ generic }) {
  const mono = (generic && generic.monograph) || {};
  const present = SECTION_ORDER.filter((k) => mono[k]);
  const [open, setOpen] = useState(() => present.slice(0, 4));
  if (!present.length) return <MedEmpty icon={I.doc} title="No monograph recorded for this generic" />;
  const toggle = (k) => setOpen((o) => (o.indexOf(k) >= 0 ? o.filter((x) => x !== k) : o.concat(k)));
  return (
    <div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={MK.btnGhost} onClick={() => setOpen(present)}>Expand all</button>
        <button style={MK.btnGhost} onClick={() => setOpen([])}>Collapse all</button>
      </div>
      {present.map((k) => {
        const isOpen = open.indexOf(k) >= 0;
        const danger = k === 'contraindications' || k === 'interaction' || k === 'overdose';
        return (
          <div key={k} style={{ border: '1px solid ' + MK.LINE, borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: '#fff' }}>
            <button onClick={() => toggle(k)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', border: 0, background: danger ? 'rgba(210,58,82,.05)' : 'rgba(125,145,180,.05)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: danger ? '#d23a52' : MK.INK }}>{SECTION_LABEL[k] || k}</span>
              <span style={{ color: MK.FAINT, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><Ic d={I.chevR} s={14} /></span>
            </button>
            {isOpen ? <div style={{ padding: '13px 15px', fontSize: 12.5, lineHeight: 1.65, color: MK.BODY }}><Monograph html={generic.monograph[k]} /></div> : null}
          </div>
        );
      })}
    </div>
  );
}

function GenericHeader({ generic, extra }) {
  if (!generic) return null;
  return (
    <div style={{ ...MK.card, marginBottom: 14 }}>
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, color: MK.INK }}>{generic.name}</div>
            <div style={{ fontSize: 12.5, color: MK.MUTED, marginTop: 3 }}>
              {generic.drugClass || 'Generic'}{generic.indication ? ' · ' + generic.indication : ''}
            </div>
          </div>
          {extra}
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 13, flexWrap: 'wrap' }}>
          <span style={MK.gchip('blue')}>{generic.brands || 0} brands</span>
          <PregChip cat={generic.pregnancyCategory} big />
          <AbxChip on={generic.abx} />
          {generic.manufacturers ? <span style={MK.gchip('slate')}>{generic.manufacturers} companies</span> : null}
          {(generic.forms || []).slice(0, 6).map((f) => <span key={f} style={MK.gchip('teal')}>{f}</span>)}
        </div>
      </div>
    </div>
  );
}

function MedGeneric({ id, setRoute }) {
  const [d, setD] = useState({ loading: true });
  const fav = useFavourites();
  useEffect(() => {
    setD({ loading: true });
    medApi.get('/api/med/generic/' + encodeURIComponent(id)).then((r) => {
      setD({ loading: false, ...r });
      if (r && r.ok) pushRecent({ id: r.generic.id, kind: 'generic', name: r.generic.name, sub: r.generic.drugClass });
    }).catch(() => setD({ loading: false, ok: false }));
  }, [id]);
  if (d.loading) return <div style={MK.page}><div style={{ padding: 40, textAlign: 'center', color: MK.FAINT }}>Loading…</div></div>;
  if (!d.ok) return <div style={MK.page}><div style={MK.card}><MedEmpty title="Generic not found" /></div></div>;
  const g = d.generic;
  return (
    <div style={MK.page}>
      <button style={{ ...MK.btnGhost, marginBottom: 12 }} onClick={() => setRoute({ view: 'medBrowse' })}>← Back to the index</button>
      <GenericHeader generic={g} extra={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <FavStar entry={{ id: g.id, kind: 'generic', name: g.name, sub: g.drugClass }} fav={fav} />
          <button style={MK.btnGhost} onClick={() => window.print()}><Ic d={I.print} s={14} />Print</button>
          <button style={MK.btnPri} onClick={() => setRoute({ view: 'medRxNew', id: g.id })}><Ic d={I.plus} s={14} />Prescribe</button>
        </div>
      } />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }} className="med-2col">
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>Monograph</div></div>
          <div style={MK.cardBody}><MonographSections generic={g} /></div>
        </div>
        <div style={MK.card}>
          <div style={MK.cardHead}>
            <div style={MK.h3}>Brands <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· cheapest first</span></div>
          </div>
          <div style={{ maxHeight: 620, overflowY: 'auto' }}>
            <table className="tbl" style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Brand</th><th style={{ textAlign: 'left' }}>Company</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
              <tbody>
                {(d.brands || []).map((b) => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setRoute({ view: 'medBrand', id: b.id })}>
                    <td><span style={{ fontWeight: 700, color: MK.INK }}>{b.name}</span><div style={{ fontSize: 10.5, color: MK.FAINT }}>{b.strength} {b.form}</div></td>
                    <td style={{ color: MK.MUTED, fontSize: 11 }}>{b.manufacturer}</td>
                    <td style={{ textAlign: 'right', fontFamily: MK.MONO, fontSize: 11.5 }}>{money(b.price && b.price.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '9px 15px', borderTop: '1px solid ' + MK.LINE }}><PriceNote /></div>
        </div>
      </div>
    </div>
  );
}

// Photo + formulary, the two things a hospital maintains about a brand. Admin-only,
// because both are shared by everyone who prescribes.
function BrandAdminPanel({ brand, onChanged }) {
  const [f, setF] = useState({ stocked: !!brand.stocked, preferred: !!brand.preferred, formularyNote: brand.formularyNote || '' });
  const save = () => medApi.put('/api/med/brand/' + brand.id + '/formulary', f).then((r) => {
    if (r && r.ok) { medToast('Formulary updated'); onChanged && onChanged(); }
    else medToast((r && r.error) || 'Could not update.', 'error');
  }).catch(() => medToast('Could not reach the server.', 'error'));
  return (
    <div style={{ ...MK.card, marginBottom: 14 }}>
      <div style={MK.cardHead}><div style={MK.h3}>Hospital record</div></div>
      <div style={{ padding: '15px 19px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: MK.FAINT, marginBottom: 8 }}>Photograph</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <DrugImage brand={brand} size={64} />
            <ImageUploader brand={brand} onChanged={onChanged} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: MK.FAINT, marginBottom: 8 }}>Formulary</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: MK.BODY, marginBottom: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.stocked} onChange={(e) => setF({ ...f, stocked: e.target.checked })} />
            We stock this brand
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: MK.BODY, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.preferred} onChange={(e) => setF({ ...f, preferred: e.target.checked, stocked: e.target.checked || f.stocked })} />
            Preferred first choice
          </label>
          <input className="inp" style={{ width: '100%', fontSize: 12 }} placeholder="Note (e.g. ward stock only)"
            value={f.formularyNote} onChange={(e) => setF({ ...f, formularyNote: e.target.value })} />
          <button style={{ ...MK.btnPri, marginTop: 9 }} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

function MedBrand({ id, setRoute }) {
  const [d, setD] = useState({ loading: true });
  const fav = useFavourites();
  const load = useCallback(() => medApi.get('/api/med/brand/' + encodeURIComponent(id))
    .then((r) => {
      setD({ loading: false, ...r });
      if (r && r.ok) pushRecent({ id: r.brand.id, kind: 'brand', name: r.brand.name, sub: [r.brand.strength, r.brand.form].filter(Boolean).join(' ') });
    })
    .catch(() => setD({ loading: false, ok: false })), [id]);
  useEffect(() => { setD({ loading: true }); load(); }, [load]);
  if (d.loading) return <div style={MK.page}><div style={{ padding: 40, textAlign: 'center', color: MK.FAINT }}>Loading…</div></div>;
  if (!d.ok) return <div style={MK.page}><div style={MK.card}><MedEmpty title="Brand not found" /></div></div>;
  const b = d.brand, g = d.generic;
  const cheaper = (d.alternatives || []).filter((a) => a.price && b.price && a.price.unit != null && b.price.unit != null && a.price.unit < b.price.unit);
  return (
    <div style={MK.page}>
      <button style={{ ...MK.btnGhost, marginBottom: 12 }} onClick={() => setRoute({ view: 'medBrowse' })}>← Back to the index</button>

      <div style={{ ...MK.card, marginBottom: 14 }}>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 15, alignItems: 'flex-start' }}>
              <DrugImage brand={b} size={78} />
              <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: MK.INK }}>{b.name} <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 16 }}>{b.strength}</span> <TypeChip type={b.type} /></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 2px' }}>
                <StockChip brand={b} /><PregChip cat={b.pregnancyCategory} /><AbxChip on={b.abx} />
              </div>
              <div style={{ fontSize: 13, color: MK.MUTED, marginTop: 4 }}>
                {b.form ? b.form + ' · ' : ''}
                {g ? <a style={{ color: '#0090ca', cursor: 'pointer', fontWeight: 600 }} onClick={() => setRoute({ view: 'medGeneric', id: g.id })}>{b.generic}</a> : b.generic}
              </div>
              <div style={{ fontSize: 12, color: MK.FAINT, marginTop: 3 }}>{b.manufacturer}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: MK.INK, fontFamily: MK.MONO }}>{money(b.price && b.price.unit)}</div>
              <div style={{ fontSize: 11, color: MK.MUTED }}>{(b.price && b.price.unitLabel) || 'unit price'}</div>
              <div style={{ marginTop: 3 }}><PriceNote /></div>
              <button style={{ ...MK.btnPri, marginTop: 10 }} onClick={() => setRoute({ view: 'medRxNew', id: b.id })}><Ic d={I.plus} s={14} />Prescribe</button>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}><FavStar entry={{ id: b.id, kind: 'brand', name: b.name, sub: b.strength + ' ' + (b.form || '') }} fav={fav} /></div>
            </div>
          </div>
          {(b.price && b.price.packs || []).length ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {b.price.packs.map((p, i) => (
                <span key={i} style={{ ...MK.gchip('slate'), fontFamily: MK.MONO }}>{p.label}: {money(p.price)}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {cheaper.length ? (
        <div style={{ ...MK.card, marginBottom: 14, border: '1px solid rgba(31,157,87,.3)' }}>
          <div style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Ic d={I.trend} s={16} />
            <span style={{ fontSize: 12.5, color: MK.BODY }}>
              <strong>{cheaper.length}</strong> cheaper brand{cheaper.length === 1 ? '' : 's'} carry the same generic — the cheapest is{' '}
              <a style={{ color: '#0090ca', cursor: 'pointer', fontWeight: 700 }} onClick={() => setRoute({ view: 'medBrand', id: cheaper[0].id })}>{cheaper[0].name}</a>{' '}
              at {money(cheaper[0].price.unit)}.
            </span>
          </div>
        </div>
      ) : null}

      {medIsAdmin() ? <BrandAdminPanel brand={b} onChanged={load} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }} className="med-2col">
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>Monograph <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· {b.generic}</span></div></div>
          <div style={MK.cardBody}>{g ? <MonographSections generic={g} /> : <MedEmpty title="No generic linked to this brand" />}</div>
        </div>
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>Same generic <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· {(d.alternatives || []).length}</span></div></div>
          <div style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table className="tbl" style={{ width: '100%', fontSize: 12 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Brand</th><th style={{ textAlign: 'left' }}>Company</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
              <tbody>
                {(d.alternatives || []).map((a) => (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setRoute({ view: 'medBrand', id: a.id })}>
                    <td><span style={{ fontWeight: 700, color: MK.INK }}>{a.name}</span><div style={{ fontSize: 10.5, color: MK.FAINT }}>{a.strength} {a.form}</div></td>
                    <td style={{ color: MK.MUTED, fontSize: 11 }}>{a.manufacturer}</td>
                    <td style={{ textAlign: 'right', fontFamily: MK.MONO, fontSize: 11.5 }}>{money(a.price && a.price.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '9px 15px', borderTop: '1px solid ' + MK.LINE }}><PriceNote /></div>
        </div>
      </div>
    </div>
  );
}

/* ================= the prescription pad ================= */

const blankRx = () => ({
  uhid: '', patientName: '', age: '', sex: '', weight: '', phone: '', address: '', allergies: '',
  date: today(), dept: '', deptName: '', complaints: '', findings: '', diagnosis: '', investigations: '',
  advice: '', followUp: '', items: [], status: 'draft',
  doctorName: '', doctorQualification: '', doctorDesignation: '', doctorReg: '', acknowledged: false,
});

function WarningPanel({ warnings, acknowledged, onAck, hideAck }) {
  if (!warnings || !warnings.length) return null;
  // 'critical' is an allergy clash — it outranks an interaction and must read that way.
  const crit = warnings.filter((w) => w.severity === 'critical');
  const high = warnings.filter((w) => w.severity === 'high' || w.severity === 'critical');
  return (
    <div style={{ ...MK.card, marginBottom: 13, border: '1px solid ' + (high.length ? 'rgba(210,58,82,.35)' : 'rgba(224,138,30,.3)') }}>
      <div style={{ ...MK.cardHead, background: high.length ? 'rgba(210,58,82,.06)' : 'rgba(224,138,30,.06)' }}>
        <div style={{ ...MK.h3, color: high.length ? '#d23a52' : '#e08a1e' }}>
          {crit.length ? crit.length + ' ALLERGY CLASH' + (crit.length === 1 ? '' : 'ES') + (high.length > crit.length ? ' + ' + (high.length - crit.length) + ' more' : '')
            : high.length ? high.length + ' interaction / duplication warning' + (high.length === 1 ? '' : 's')
              : 'Prescribing notes'}
        </div>
      </div>
      <div style={{ padding: '12px 16px' }}>
        {warnings.map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < warnings.length - 1 ? '1px solid ' + MK.LINE : 0 }}>
            <span style={{ ...MK.gchip(w.severity === 'critical' || w.severity === 'high' ? 'red' : 'slate'), flexShrink: 0, height: 20 }}>
              {w.kind === 'allergy' ? 'ALLERGY' : w.kind === 'duplicate' ? 'DUPLICATE' : w.severity === 'high' ? 'INTERACTION' : 'NOTE'}
            </span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: MK.INK }}>{w.title}</div>
              <div style={{ fontSize: 12, color: MK.BODY, lineHeight: 1.55, marginTop: 2 }}>{w.detail}</div>
              {w.source ? <div style={{ fontSize: 10.5, color: MK.FAINT, marginTop: 2 }}>from the {w.source}</div> : null}
            </div>
          </div>
        ))}
        {high.length && !hideAck ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, fontSize: 12.5, color: MK.BODY, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!acknowledged} onChange={(e) => onAck(e.target.checked)} />
            I have reviewed these warnings and intend to prescribe as written.
          </label>
        ) : null}
        <div style={{ fontSize: 10.5, color: MK.FAINT, marginTop: 10, lineHeight: 1.5 }}>
          These notes are drawn from the generic monographs in this index. They are a prompt to check, not a clinical decision — the prescriber remains responsible.
        </div>
      </div>
    </div>
  );
}

function RxItemRow({ item, idx, onChange, onRemove, onOpen }) {
  const set = (k, v) => onChange({ ...item, [k]: v });
  return (
    <div style={{ border: '1px solid ' + MK.LINE, borderRadius: 10, padding: '11px 13px', marginBottom: 9, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 9 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <DrugImage brand={{ id: item.brandId, name: item.brand || item.generic, form: item.form, hasImage: item.hasImage }} size={34} />
          <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: MK.INK }}>
            <span style={{ fontFamily: MK.MONO, color: MK.FAINT, marginRight: 6 }}>{idx + 1}.</span>
            {item.brand || item.generic} {item.strength ? <span style={{ fontWeight: 500, color: MK.MUTED }}>{item.strength}</span> : null}
          </div>
          <div style={{ fontSize: 11, color: MK.MUTED, marginTop: 2 }}>
            {item.form ? item.form + ' · ' : ''}{item.brand && item.generic && item.brand !== item.generic ? item.generic : ''}
          </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {item.genericId ? <button style={{ ...MK.btnGhost, padding: '4px 9px', fontSize: 11 }} onClick={() => onOpen(item.genericId)}>Monograph</button> : null}
          <button style={{ ...MK.btnGhost, padding: '4px 9px', fontSize: 11, color: '#d23a52' }} onClick={onRemove}><Ic d={I.x} s={12} /></button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(122px,1fr))', gap: 7 }}>
        <input className="inp" style={{ fontSize: 12 }} placeholder="Dose (1 tab)" value={item.dose} onChange={(e) => set('dose', e.target.value)} />
        <input className="inp" style={{ fontSize: 12 }} placeholder="Frequency" list="rx-freq" value={item.frequency} onChange={(e) => set('frequency', e.target.value)} />
        <input className="inp" style={{ fontSize: 12 }} placeholder="Timing" list="rx-timing" value={item.timing} onChange={(e) => set('timing', e.target.value)} />
        <input className="inp" style={{ fontSize: 12 }} placeholder="Duration" list="rx-duration" value={item.duration} onChange={(e) => set('duration', e.target.value)} />
        <input className="inp" style={{ fontSize: 12 }} placeholder="Qty" value={item.quantity} onChange={(e) => set('quantity', e.target.value)} />
      </div>
      <input className="inp" style={{ fontSize: 12, marginTop: 7, width: '100%' }} placeholder="Special instruction (optional)" value={item.instruction} onChange={(e) => set('instruction', e.target.value)} />
    </div>
  );
}

function RxEditor({ rxId, seedId, setRoute }) {
  const [rx, setRx] = useState(blankRx);
  const [q, setQ] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [monoFor, setMonoFor] = useState(null);
  const set = (k, v) => setRx((r) => ({ ...r, [k]: v }));

  // Prefill the prescriber from the signed-in user and the shared saved sign-off
  // names, so the commonest four fields are not retyped on every prescription.
  useEffect(() => {
    if (rxId) return;
    try {
      const u = window.__UNICO_USER__;
      const sig = window.unicoSig && window.unicoSig.get ? window.unicoSig.get() : null;
      setRx((r) => ({ ...r, doctorName: (u && u.name) || (sig && sig.prepared) || '' }));
    } catch (e) {}
  }, [rxId]);

  useEffect(() => {
    medApi.get('/api/rx-templates').then((r) => setTemplates((r && r.templates) || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!rxId) return;
    medApi.get('/api/prescriptions/' + encodeURIComponent(rxId)).then((r) => {
      if (r && r.ok) setRx({ ...blankRx(), ...r.prescription });
    }).catch(() => {});
  }, [rxId]);

  // Arriving from a brand or generic page ("Prescribe") starts the pad with that drug
  // already on it, which is the whole point of the button.
  useEffect(() => {
    if (!seedId || rxId) return;
    const url = seedId.indexOf('gen-') === 0 ? '/api/med/generic/' + seedId : '/api/med/brand/' + seedId;
    medApi.get(url).then((r) => {
      if (!r || !r.ok) return;
      if (r.brand) addBrand(r.brand);
      else if (r.generic) addGeneric(r.generic);
    }).catch(() => {});
  }, [seedId, rxId]);

  // Past prescriptions for this patient, so a repeat is one click and the prescriber
  // can see what they were last given.
  useEffect(() => {
    const u = String(rx.uhid || '').trim();
    if (u.length < 3) { setHistory([]); return; }
    const t = setTimeout(() => {
      medApi.get('/api/prescriptions?' + qs({ uhid: u, limit: 8 })).then((r) => setHistory((r && r.prescriptions) || [])).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [rx.uhid]);

  // Re-check whenever the drug list changes. Keyed on the generic ids only, so
  // editing a dose does not fire a network request per keystroke.
  const genericKey = useMemo(() => rx.items.map((i) => i.genericId).filter(Boolean).join(','), [rx.items]);
  useEffect(() => {
    const ids = genericKey ? genericKey.split(',') : [];
    if (!ids.length) { setWarnings([]); return; }
    // Allergies go with the drugs: a penicillin allergy against a prescribed
    // amoxicillin is the single most valuable check this module can make, and it has
    // to re-run when EITHER the drug list or the allergy field changes.
    const t = setTimeout(() => {
      medApi.post('/api/med/check', { genericIds: ids, allergies: rx.allergies })
        .then((r) => setWarnings((r && r.warnings) || [])).catch(() => setWarnings([]));
    }, 250);
    return () => clearTimeout(t);
  }, [genericKey, rx.allergies]);

  const addItem = (it) => setRx((r) => ({ ...r, items: r.items.concat([{ dose: '', frequency: '', timing: '', duration: '', quantity: '', instruction: '', ...it }]) }));
  const addBrand = (b) => addItem({ brandId: b.id, brand: b.name, generic: b.generic, genericId: b.genericId, strength: b.strength, form: b.form });
  const addGeneric = (g) => addItem({ generic: g.name, genericId: g.id, form: (g.forms || [])[0] || '' });
  const onPick = (p) => { if (p.kind === 'brand') addBrand(p.doc); else addGeneric(p.doc); setQ(''); };
  const setItem = (i, v) => setRx((r) => ({ ...r, items: r.items.map((x, n) => (n === i ? v : x)) }));
  const delItem = (i) => setRx((r) => ({ ...r, items: r.items.filter((_, n) => n !== i) }));

  const applyTemplate = (t) => {
    setRx((r) => ({
      ...r,
      diagnosis: r.diagnosis || t.diagnosis || '',
      advice: r.advice || t.advice || '',
      investigations: r.investigations || t.investigations || '',
      items: r.items.concat(t.items || []),
    }));
    medToast('Template “' + t.name + '” added');
  };

  const repeat = (id) => {
    medApi.get('/api/prescriptions/' + encodeURIComponent(id)).then((r) => {
      if (!r || !r.ok) return;
      setRx((cur) => ({ ...cur, items: cur.items.concat(r.prescription.items || []), diagnosis: cur.diagnosis || r.prescription.diagnosis || '' }));
      medToast('Previous prescription copied onto the pad');
    }).catch(() => {});
  };

  const highWarnings = warnings.filter((w) => w.severity === 'high' || w.severity === 'critical');
  const save = (status) => {
    if (!String(rx.patientName || '').trim()) { medToast('A patient name is required.', 'error'); return; }
    if (status === 'issued') {
      if (!rx.items.length) { medToast('Add at least one drug before issuing.', 'error'); return; }
      if (highWarnings.length && !rx.acknowledged) { medToast('Review and acknowledge the warnings before issuing.', 'error'); return; }
    }
    setSaving(true);
    medApi.put('/api/prescriptions', { ...rx, id: rxId || undefined, status, warnings })
      .then((r) => {
        setSaving(false);
        if (!r || !r.ok) { medToast((r && r.error) || 'Could not save.', 'error'); return; }
        medToast(status === 'issued' ? 'Prescription issued' : 'Draft saved');
        if (status === 'issued') setRoute({ view: 'medRxPrint', rx: r.prescription.id });
        else setRoute({ view: 'medRxNew', rx: r.prescription.id });
      }).catch(() => { setSaving(false); medToast('Could not reach the server.', 'error'); });
  };

  const locked = rx.status === 'issued';

  return (
    <div style={MK.page}>
      <datalist id="rx-freq">{FREQ.map((f) => <option key={f} value={f} />)}</datalist>
      <datalist id="rx-timing">{TIMING.map((f) => <option key={f} value={f} />)}</datalist>
      <datalist id="rx-duration">{DURATION.map((f) => <option key={f} value={f} />)}</datalist>

      {locked ? (
        <div style={{ ...MK.card, marginBottom: 13, border: '1px solid rgba(31,157,87,.35)' }}>
          <div style={{ padding: '12px 17px', fontSize: 12.5, color: MK.BODY, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={MK.gchip('green')}>ISSUED</span>
            This prescription has been issued and is a clinical record — it can be printed but not edited. Write a new one to change it.
            <button style={MK.btnPri} onClick={() => setRoute({ view: 'medRxPrint', rx: rxId })}><Ic d={I.print} s={13} />Print</button>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }} className="med-2col">
        <div>
          {/* patient */}
          <div style={{ ...MK.card, marginBottom: 13 }}>
            <div style={MK.cardHead}><div style={MK.h3}>Patient</div><div style={{ fontSize: 11.5, color: MK.MUTED, fontFamily: MK.MONO }}>{rx.date}</div></div>
            <div style={{ padding: '15px 18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 9 }}>
                <input className="inp" placeholder="UHID" value={rx.uhid} disabled={locked} onChange={(e) => set('uhid', e.target.value)} />
                <input className="inp" placeholder="Patient name *" value={rx.patientName} disabled={locked} onChange={(e) => set('patientName', e.target.value)} />
                <input className="inp" placeholder="Age" value={rx.age} disabled={locked} onChange={(e) => set('age', e.target.value)} />
                <select className="inp" value={rx.sex} disabled={locked} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">Sex</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
                <input className="inp" placeholder="Weight (kg)" value={rx.weight} disabled={locked} onChange={(e) => set('weight', e.target.value)} />
                <input className="inp" placeholder="Phone" value={rx.phone} disabled={locked} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <input className="inp" style={{ width: '100%', marginTop: 9 }} placeholder="Known allergies — written on the printed prescription"
                value={rx.allergies} disabled={locked} onChange={(e) => set('allergies', e.target.value)} />
              {rx.allergies ? (
                <div style={{ marginTop: 8, padding: '8px 11px', background: 'rgba(210,58,82,.07)', borderRadius: 8, fontSize: 12, color: '#d23a52', fontWeight: 600 }}>
                  Allergy on record: {rx.allergies}
                </div>
              ) : null}
            </div>
          </div>

          {/* clinical */}
          <div style={{ ...MK.card, marginBottom: 13 }}>
            <div style={MK.cardHead}><div style={MK.h3}>Clinical</div></div>
            <div style={{ padding: '15px 18px', display: 'grid', gap: 9 }}>
              <textarea className="inp" rows={2} placeholder="Chief complaints" value={rx.complaints} disabled={locked} onChange={(e) => set('complaints', e.target.value)} />
              <textarea className="inp" rows={2} placeholder="On examination / findings" value={rx.findings} disabled={locked} onChange={(e) => set('findings', e.target.value)} />
              <textarea className="inp" rows={2} placeholder="Diagnosis" value={rx.diagnosis} disabled={locked} onChange={(e) => set('diagnosis', e.target.value)} />
              <textarea className="inp" rows={2} placeholder="Investigations advised" value={rx.investigations} disabled={locked} onChange={(e) => set('investigations', e.target.value)} />
            </div>
          </div>

          {/* Rx */}
          <div style={cardOpen({ marginBottom: 13 })}>
            <div style={MK.cardHead}>
              <div style={MK.h3}><span style={{ fontFamily: 'serif', fontSize: 19, marginRight: 5 }}>℞</span>Medication <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· {rx.items.length}</span></div>
            </div>
            <div style={{ padding: '15px 18px' }}>
              {!locked ? (
                <div style={{ marginBottom: 13 }}>
                  <DrugSearchBox value={q} onChange={setQ} onPick={onPick} placeholder="Add a drug — search brand or generic" />
                </div>
              ) : null}
              {rx.items.length ? rx.items.map((it, i) => (
                <RxItemRow key={i} item={it} idx={i} onChange={(v) => setItem(i, v)} onRemove={() => delItem(i)} onOpen={setMonoFor} />
              )) : <MedEmpty icon={I.plus} title="No drugs on the pad yet" note="Search above, or drop in one of your saved templates." />}
            </div>
          </div>

          {/* advice */}
          <div style={{ ...MK.card, marginBottom: 13 }}>
            <div style={MK.cardHead}><div style={MK.h3}>Advice &amp; follow-up</div></div>
            <div style={{ padding: '15px 18px', display: 'grid', gap: 9 }}>
              <textarea className="inp" rows={3} placeholder="Advice to the patient" value={rx.advice} disabled={locked} onChange={(e) => set('advice', e.target.value)} />
              <input className="inp" placeholder="Follow-up (e.g. after 7 days)" value={rx.followUp} disabled={locked} onChange={(e) => set('followUp', e.target.value)} />
            </div>
          </div>

          {/* prescriber */}
          <div style={{ ...MK.card, marginBottom: 13 }}>
            <div style={MK.cardHead}><div style={MK.h3}>Prescriber</div></div>
            <div style={{ padding: '15px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 9 }}>
              <input className="inp" placeholder="Doctor's name" value={rx.doctorName} disabled={locked} onChange={(e) => set('doctorName', e.target.value)} />
              <input className="inp" placeholder="Qualification (MBBS, FCPS)" value={rx.doctorQualification} disabled={locked} onChange={(e) => set('doctorQualification', e.target.value)} />
              <input className="inp" placeholder="Designation" value={rx.doctorDesignation} disabled={locked} onChange={(e) => set('doctorDesignation', e.target.value)} />
              <input className="inp" placeholder="BMDC registration no." value={rx.doctorReg} disabled={locked} onChange={(e) => set('doctorReg', e.target.value)} />
              <input className="inp" placeholder="Department / unit" value={rx.deptName} disabled={locked} onChange={(e) => set('deptName', e.target.value)} />
            </div>
          </div>

          {!locked ? (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
              <button style={MK.btnGhost} disabled={saving} onClick={() => save('draft')}>Save draft</button>
              <button style={MK.btnPri} disabled={saving} onClick={() => save('issued')}><Ic d={I.check} s={14} />Issue &amp; print</button>
              {highWarnings.length && !rx.acknowledged ? (
                <span style={{ fontSize: 11.5, color: '#d23a52', alignSelf: 'center' }}>Acknowledge the warnings to issue.</span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* right rail */}
        <div>
          <WarningPanel warnings={warnings} acknowledged={rx.acknowledged} onAck={(v) => set('acknowledged', v)} />

          {history.length ? (
            <div style={{ ...MK.card, marginBottom: 13 }}>
              <div style={MK.cardHead}><div style={MK.h3}>This patient's history</div></div>
              <div style={{ padding: '10px 15px' }}>
                {history.map((h) => (
                  <div key={h.id} style={{ padding: '8px 0', borderBottom: '1px solid ' + MK.LINE }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: MK.INK }}>{h.date}</span>
                      {!locked ? <button style={{ ...MK.btnGhost, padding: '2px 8px', fontSize: 10.5 }} onClick={() => repeat(h.id)}>Repeat</button> : null}
                    </div>
                    <div style={{ fontSize: 11.5, color: MK.MUTED, marginTop: 2 }}>{h.diagnosis || '—'}</div>
                    <div style={{ fontSize: 11, color: MK.FAINT }}>{(h.items || []).map((i) => i.brand || i.generic).join(', ')}{h.itemCount > 3 ? ' +' + (h.itemCount - 3) : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!locked && templates.length ? (
            <div style={{ ...MK.card, marginBottom: 13 }}>
              <div style={MK.cardHead}><div style={MK.h3}>Templates</div></div>
              <div style={{ padding: '10px 15px' }}>
                {templates.map((t) => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 5, border: '1px solid ' + MK.LINE, borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MK.INK }}>{t.name}</div>
                    <div style={{ fontSize: 10.5, color: MK.MUTED }}>{(t.items || []).length} drug{(t.items || []).length === 1 ? '' : 's'}{t.note ? ' · ' + t.note : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {monoFor ? <MonoDrawer id={monoFor} onClose={() => setMonoFor(null)} /> : null}
        </div>
      </div>
    </div>
  );
}

// The monograph a prescriber wants mid-prescription is the short one: how much, what
// it clashes with, who must not have it. The full text is one click further on.
function MonoDrawer({ id, onClose }) {
  const [g, setG] = useState(null);
  useEffect(() => { medApi.get('/api/med/generic/' + encodeURIComponent(id)).then((r) => setG(r && r.ok ? r.generic : null)).catch(() => setG(null)); }, [id]);
  if (!g) return null;
  const b = g.brief || {};
  return (
    <div style={{ ...MK.card, marginBottom: 13 }}>
      <div style={MK.cardHead}>
        <div style={MK.h3}>{g.name}</div>
        <button style={{ ...MK.btnGhost, padding: '3px 8px' }} onClick={onClose}><Ic d={I.x} s={12} /></button>
      </div>
      <div style={{ padding: '13px 16px', fontSize: 12, lineHeight: 1.6, color: MK.BODY }}>
        {[['Dosage', b.dosage], ['Interactions', b.interaction], ['Contraindications', b.contra], ['Pregnancy', b.pregnancy]].map(([k, v]) => v ? (
          <div key={k} style={{ marginBottom: 11 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: MK.FAINT, marginBottom: 3 }}>{k}</div>
            <div>{v.slice(0, 600)}{v.length > 600 ? '…' : ''}</div>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

/* ================= prescription list ================= */
function RxRows({ rows, setRoute }) {
  return (
    <table className="tbl" style={{ width: '100%', fontSize: 12.5 }}>
      <thead><tr>
        <th style={{ textAlign: 'left' }}>Date</th><th style={{ textAlign: 'left' }}>Patient</th>
        <th style={{ textAlign: 'left' }}>Diagnosis</th><th style={{ textAlign: 'left' }}>Drugs</th>
        <th style={{ textAlign: 'left' }}>Doctor</th><th style={{ textAlign: 'right' }}>Status</th>
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setRoute({ view: r.status === 'issued' ? 'medRxPrint' : 'medRxNew', rx: r.id })}>
            <td style={{ fontFamily: MK.MONO, fontSize: 11.5 }}>{r.date}</td>
            <td><span style={{ fontWeight: 700, color: MK.INK }}>{r.patientName}</span>
              <div style={{ fontSize: 10.5, color: MK.FAINT }}>{r.uhid ? 'UHID ' + r.uhid : ''}{r.age ? ' · ' + r.age : ''}{r.sex ? ' · ' + r.sex : ''}</div></td>
            <td style={{ color: MK.MUTED }}>{r.diagnosis || '—'}</td>
            <td style={{ color: MK.MUTED, fontSize: 11.5 }}>
              {(r.items || []).map((i) => i.brand || i.generic).join(', ') || '—'}
              {r.itemCount > 3 ? <span style={{ color: MK.FAINT }}> +{r.itemCount - 3}</span> : null}
            </td>
            <td style={{ color: MK.MUTED, fontSize: 11.5 }}>{r.doctorName || '—'}</td>
            <td style={{ textAlign: 'right' }}>
              <span style={MK.gchip(r.status === 'issued' ? 'green' : r.status === 'cancelled' ? 'red' : 'amber')}>{r.status || 'draft'}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MedRxList({ setRoute }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    medApi.get('/api/prescriptions?' + qs({ q, status, limit: 200 }))
      .then((r) => { setRows((r && r.prescriptions) || []); setLoading(false); })
      .catch(() => { setRows([]); setLoading(false); });
  }, [q, status]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);
  return (
    <div style={MK.page}>
      <div style={{ ...MK.card, marginBottom: 13 }}>
        <div style={{ padding: '15px 18px', display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="inp" style={{ flex: 1, minWidth: 220 }} placeholder="Search by patient name, UHID or diagnosis" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)} style={{ fontSize: 12 }}>
            <option value="">All statuses</option><option value="draft">Drafts</option><option value="issued">Issued</option><option value="cancelled">Cancelled</option>
          </select>
          <button style={MK.btnPri} onClick={() => setRoute({ view: 'medRxNew' })}><Ic d={I.plus} s={14} />New prescription</button>
        </div>
      </div>
      <div style={MK.card}>
        <div style={MK.cardHead}><div style={MK.h3}>Prescriptions <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· {rows.length}</span></div></div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? <div style={{ padding: 34, textAlign: 'center', color: MK.FAINT, fontSize: 12.5 }}>Loading…</div>
            : rows.length ? <RxRows rows={rows} setRoute={setRoute} />
              : <MedEmpty icon={I.doc} title="No prescriptions found" note="Nothing matches this search." />}
        </div>
      </div>
    </div>
  );
}

/* ================= printable prescription ================= */
function MedRxPrint({ rxId, setRoute }) {
  const [rx, setRx] = useState(null);
  useEffect(() => {
    medApi.get('/api/prescriptions/' + encodeURIComponent(rxId)).then((r) => setRx(r && r.ok ? r.prescription : null)).catch(() => setRx(null));
  }, [rxId]);
  if (!rx) return <div style={MK.page}><div style={{ padding: 40, textAlign: 'center', color: MK.FAINT }}>Loading…</div></div>;
  const line = (it) => [it.dose, it.frequency, it.timing, it.duration].filter(Boolean).join('  —  ');
  return (
    <div style={MK.page}>
      <div style={{ display: 'flex', gap: 9, marginBottom: 13, flexWrap: 'wrap' }} className="no-print">
        <button style={MK.btnGhost} onClick={() => setRoute({ view: 'medRxList' })}>← Prescriptions</button>
        <button style={MK.btnPri} onClick={() => window.print()}><Ic d={I.print} s={14} />Print / Save as PDF</button>
      </div>

      <div id="pdf-root" style={{ background: '#fff', color: '#111', padding: '26px 30px', borderRadius: 8, maxWidth: 860, margin: '0 auto', fontSize: 13 }}>
        {/* letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0072a3', paddingBottom: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0072a3' }}>UNICO Healthcare</div>
            <div style={{ fontSize: 11, color: '#555' }}>Prescription</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11.5, color: '#333' }}>
            <div><strong>{rx.doctorName || '—'}</strong></div>
            {rx.doctorQualification ? <div>{rx.doctorQualification}</div> : null}
            {rx.doctorDesignation ? <div>{rx.doctorDesignation}</div> : null}
            {rx.doctorReg ? <div>BMDC Reg. {rx.doctorReg}</div> : null}
            {rx.deptName ? <div>{rx.deptName}</div> : null}
          </div>
        </div>

        {/* patient strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, fontSize: 12, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #ddd' }}>
          <div><span style={{ color: '#777' }}>Name: </span><strong>{rx.patientName}</strong></div>
          <div><span style={{ color: '#777' }}>UHID: </span>{rx.uhid || '—'}</div>
          <div><span style={{ color: '#777' }}>Age/Sex: </span>{[rx.age, rx.sex].filter(Boolean).join(' / ') || '—'}</div>
          <div><span style={{ color: '#777' }}>Date: </span>{rx.date}</div>
        </div>

        {rx.allergies ? (
          <div style={{ padding: '7px 11px', border: '1.5px solid #d23a52', color: '#d23a52', borderRadius: 5, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            ALLERGIES: {rx.allergies}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
          {/* left column — the clinical note */}
          <div style={{ borderRight: '1px solid #ddd', paddingRight: 16, fontSize: 12 }}>
            {[['Chief complaints', rx.complaints], ['On examination', rx.findings], ['Diagnosis', rx.diagnosis], ['Investigations', rx.investigations]].map(([k, v]) => v ? (
              <div key={k} style={{ marginBottom: 11 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: '#0072a3', marginBottom: 3 }}>{k}</div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{v}</div>
              </div>
            ) : null)}
          </div>

          {/* right column — the Rx itself */}
          <div>
            <div style={{ fontFamily: 'serif', fontSize: 30, fontWeight: 700, color: '#0072a3', lineHeight: 1, marginBottom: 10 }}>℞</div>
            {(rx.items || []).map((it, i) => (
              <div key={i} style={{ marginBottom: 12, paddingBottom: 9, borderBottom: '1px dotted #ccc' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                  {i + 1}. {it.brand || it.generic} {it.strength ? <span style={{ fontWeight: 400 }}>{it.strength}</span> : null}
                  {it.form ? <span style={{ fontWeight: 400, color: '#666', fontSize: 11.5 }}> ({it.form})</span> : null}
                </div>
                {it.brand && it.generic && it.brand !== it.generic ? (
                  <div style={{ fontSize: 10.5, color: '#777', fontStyle: 'italic' }}>{it.generic}</div>
                ) : null}
                <div style={{ fontSize: 12.5, marginTop: 3, marginLeft: 15 }}>{line(it) || '—'}{it.quantity ? '   ·   Qty ' + it.quantity : ''}</div>
                {it.instruction ? <div style={{ fontSize: 11.5, marginLeft: 15, color: '#444', fontStyle: 'italic' }}>{it.instruction}</div> : null}
              </div>
            ))}
            {!(rx.items || []).length ? <div style={{ color: '#999', fontSize: 12 }}>No medication prescribed.</div> : null}
          </div>
        </div>

        {rx.advice ? (
          <div style={{ marginTop: 16, paddingTop: 11, borderTop: '1px solid #ddd', fontSize: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: '#0072a3', marginBottom: 3 }}>Advice</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{rx.advice}</div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30 }}>
          <div style={{ fontSize: 12 }}>{rx.followUp ? <span><strong>Follow-up:</strong> {rx.followUp}</span> : null}</div>
          <div style={{ textAlign: 'center', minWidth: 200 }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: 5, fontSize: 11.5 }}>
              <strong>{rx.doctorName || ''}</strong>
              {rx.doctorQualification ? <div style={{ fontSize: 10.5, color: '#555' }}>{rx.doctorQualification}</div> : null}
              <div style={{ fontSize: 10, color: '#777' }}>Signature of the prescriber</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #eee', fontSize: 9, color: '#999', lineHeight: 1.5 }}>
          Generated by UNICO Healthcare · {rx.date} · Ref {rx.id}
          <br />Drug information from a public-domain Bangladesh medicine index (2022 snapshot); prices where shown are indicative. Not a substitute for the prescriber's clinical judgement.
        </div>
      </div>
    </div>
  );
}

/* ================= templates ================= */
function MedTemplates({ setRoute }) {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const load = () => medApi.get('/api/rx-templates').then((r) => setRows((r && r.templates) || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  const save = () => {
    if (!String(edit.name || '').trim()) { medToast('Give the template a name.', 'error'); return; }
    medApi.put('/api/rx-templates', edit).then((r) => {
      if (r && r.ok) { medToast('Template saved'); setEdit(null); load(); }
      else medToast((r && r.error) || 'Could not save.', 'error');
    }).catch(() => medToast('Could not reach the server.', 'error'));
  };
  const remove = (id) => medApi.del('/api/rx-templates/' + id).then(() => { medToast('Template deleted'); load(); }).catch(() => {});

  if (edit) {
    const addItem = (p) => {
      const d = p.doc;
      const it = p.kind === 'brand'
        ? { brandId: d.id, brand: d.name, generic: d.generic, genericId: d.genericId, strength: d.strength, form: d.form }
        : { generic: d.name, genericId: d.id, form: (d.forms || [])[0] || '' };
      setEdit((e) => ({ ...e, items: (e.items || []).concat([{ dose: '', frequency: '', timing: '', duration: '', quantity: '', instruction: '', ...it }]) }));
      setQ('');
    };
    return (
      <div style={MK.page}>
        <div style={cardOpen()}>
          <div style={MK.cardHead}>
            <div style={MK.h3}>{edit.id ? 'Edit template' : 'New template'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={MK.btnGhost} onClick={() => setEdit(null)}>Cancel</button>
              <button style={MK.btnPri} onClick={save}>Save template</button>
            </div>
          </div>
          <div style={{ padding: '16px 19px', display: 'grid', gap: 10 }}>
            <input className="inp" placeholder="Template name — e.g. URTI adult, Post-op day 1" value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <input className="inp" placeholder="Note (optional)" value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
            <input className="inp" placeholder="Default diagnosis (optional)" value={edit.diagnosis || ''} onChange={(e) => setEdit({ ...edit, diagnosis: e.target.value })} />
            <textarea className="inp" rows={2} placeholder="Default advice (optional)" value={edit.advice || ''} onChange={(e) => setEdit({ ...edit, advice: e.target.value })} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: MK.FAINT, margin: '6px 0 7px' }}>Drugs</div>
              <DrugSearchBox value={q} onChange={setQ} onPick={addItem} placeholder="Add a drug to this template" />
              <div style={{ marginTop: 11 }}>
                {(edit.items || []).map((it, i) => (
                  <RxItemRow key={i} item={it} idx={i}
                    onChange={(v) => setEdit((e) => ({ ...e, items: e.items.map((x, n) => (n === i ? v : x)) }))}
                    onRemove={() => setEdit((e) => ({ ...e, items: e.items.filter((_, n) => n !== i) }))}
                    onOpen={() => {}} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={MK.page}>
      <div style={MK.card}>
        <div style={MK.cardHead}>
          <div style={MK.h3}>Prescription templates <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· {rows.length}</span></div>
          <button style={MK.btnPri} onClick={() => setEdit({ name: '', items: [] })}><Ic d={I.plus} s={14} />New template</button>
        </div>
        <div style={MK.cardBody}>
          {rows.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 11 }}>
              {rows.map((t) => (
                <div key={t.id} style={{ border: '1px solid ' + MK.LINE, borderRadius: 11, padding: '13px 15px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: MK.INK }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button style={{ ...MK.btnGhost, padding: '3px 8px', fontSize: 10.5 }} onClick={() => setEdit(t)}>Edit</button>
                      <button style={{ ...MK.btnGhost, padding: '3px 8px', fontSize: 10.5, color: '#d23a52' }} onClick={() => remove(t.id)}><Ic d={I.x} s={11} /></button>
                    </div>
                  </div>
                  {t.note ? <div style={{ fontSize: 11.5, color: MK.MUTED, marginTop: 3 }}>{t.note}</div> : null}
                  <div style={{ fontSize: 11.5, color: MK.BODY, marginTop: 8, lineHeight: 1.55 }}>
                    {(t.items || []).map((i) => i.brand || i.generic).join(', ') || 'No drugs yet'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedEmpty icon={I.star} title="No templates yet"
              note="A template is a drug set you prescribe often — save it once and drop it onto the pad in a click."
              action={<button style={MK.btnPri} onClick={() => setEdit({ name: '', items: [] })}>Create one</button>} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= catalogue admin ================= */
function MedCatalog({ setRoute }) {
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null);
  const [form, setForm] = useState(null);
  const admin = medIsAdmin();

  const open = (p) => {
    if (p.kind === 'brand') {
      medApi.get('/api/med/brand/' + p.doc.id).then((r) => {
        if (!r || !r.ok) return;
        setPick({ kind: 'brand', doc: r.brand });
        setForm({ name: r.brand.name, strength: r.brand.strength, form: r.brand.form, manufacturer: r.brand.manufacturer, unit: (r.brand.price && r.brand.price.unit) || '', unitLabel: (r.brand.price && r.brand.price.unitLabel) || '' });
      });
    } else {
      medApi.get('/api/med/generic/' + p.doc.id).then((r) => {
        if (!r || !r.ok) return;
        setPick({ kind: 'generic', doc: r.generic });
        setForm({ name: r.generic.name, drugClass: r.generic.drugClass, monograph: { ...(r.generic.monograph || {}) } });
      });
    }
  };
  const save = () => {
    if (pick.kind === 'brand') {
      medApi.put('/api/med/brand/' + pick.doc.id, {
        name: form.name, strength: form.strength, form: form.form, manufacturer: form.manufacturer,
        price: { unit: form.unit === '' ? null : Number(form.unit), unitLabel: form.unitLabel, raw: '', packs: (pick.doc.price && pick.doc.price.packs) || [] },
      }).then((r) => { if (r && r.ok) { medToast('Brand updated — it will survive the next import'); setPick(null); } else medToast((r && r.error) || 'Could not save.', 'error'); });
    } else {
      medApi.put('/api/med/generic/' + pick.doc.id, { name: form.name, drugClass: form.drugClass, monograph: form.monograph })
        .then((r) => { if (r && r.ok) { medToast('Monograph updated'); setPick(null); } else medToast((r && r.error) || 'Could not save.', 'error'); });
    }
  };

  if (!admin) {
    return <div style={MK.page}><div style={MK.card}><MedEmpty icon={I.gear} title="Administrator access required"
      note="The drug catalogue is shared by everyone who prescribes, so corrections to it are made by an administrator." /></div></div>;
  }

  return (
    <div style={MK.page}>
      <div style={cardOpen({ marginBottom: 13 })}>
        <div style={{ padding: '16px 19px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: MK.INK, marginBottom: 4 }}>Drug catalogue</div>
          <div style={{ ...MK.sub, marginBottom: 13 }}>
            Correct a price, a strength or a monograph. Anything you change here is marked as locally edited and is left alone the next time the index is re-imported.
          </div>
          <DrugSearchBox value={q} onChange={setQ} onPick={open} placeholder="Find the brand or generic to correct" />
        </div>
      </div>

      {pick ? (
        <div style={MK.card}>
          <div style={MK.cardHead}>
            <div style={MK.h3}>{pick.doc.name} <span style={{ fontWeight: 500, color: MK.MUTED, fontSize: 12 }}>· {pick.kind}</span></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={MK.btnGhost} onClick={() => setPick(null)}>Cancel</button>
              <button style={MK.btnPri} onClick={save}>Save correction</button>
            </div>
          </div>
          <div style={{ padding: '16px 19px', display: 'grid', gap: 10 }}>
            {pick.kind === 'brand' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 9 }}>
                  <input className="inp" placeholder="Brand name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className="inp" placeholder="Strength" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} />
                  <input className="inp" placeholder="Dosage form" value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })} />
                  <input className="inp" placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                  <input className="inp" placeholder="Unit price" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  <input className="inp" placeholder="Unit label (e.g. 100 ml bottle)" value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
                </div>
                <div style={{ fontSize: 11, color: MK.FAINT }}>Original price string from the source: {(pick.doc.price && pick.doc.price.raw) || '—'}</div>
              </>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 9 }}>
                  <input className="inp" placeholder="Generic name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className="inp" placeholder="Drug class" value={form.drugClass} onChange={(e) => setForm({ ...form, drugClass: e.target.value })} />
                </div>
                {SECTION_ORDER.filter((k) => form.monograph[k] != null || k === 'dosage').map((k) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: MK.FAINT, marginBottom: 4 }}>{SECTION_LABEL[k] || k}</div>
                    <textarea className="inp" rows={3} style={{ width: '100%', fontFamily: MK.MONO, fontSize: 11.5 }}
                      value={form.monograph[k] || ''} onChange={(e) => setForm({ ...form, monograph: { ...form.monograph, [k]: e.target.value } })} />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: MK.FAINT }}>Basic HTML is allowed: &lt;strong&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;br&gt;.</div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ================= drug images =================
 * WHY THERE IS NO STOCK PHOTO LIBRARY
 * No open-licensed photograph set exists for Bangladeshi brands. The CC0 index has no
 * image column; MedEx's pack photos are copyrighted; and the public-domain NLM pill
 * images are US products keyed by NDC, so showing one beside a Beximco strip would be
 * actively misleading — identification is the entire purpose of a drug photograph.
 *
 * So there are two honest sources. The hospital's OWN photograph of the strip or pack,
 * uploaded here; and, until one exists, a generated glyph that encodes what we DO know
 * — the dosage form, and a colour derived from the name so the same drug always looks
 * the same. The glyph never pretends to be a photograph.
 */
const FORM_SHAPE = (form) => {
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
const hueOf = (s) => { let h = 0; String(s || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) % 360; }); return h; };

function DrugGlyph({ form, name, size }) {
  const z = size || 46;
  const shape = FORM_SHAPE(form);
  const h = hueOf(name || form);
  const fill = 'hsl(' + h + ' 55% 62%)', dark = 'hsl(' + h + ' 52% 44%)';
  const box = { width: z, height: z, borderRadius: 10, background: 'hsl(' + h + ' 60% 96%)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid hsl(' + h + ' 40% 88%)' };
  const S = z * 0.62;
  const art = {
    tablet: <g><circle cx="12" cy="12" r="8.5" fill={fill} /><path d="M6 12h12" stroke={dark} strokeWidth="1.6" /></g>,
    capsule: <g><rect x="3.5" y="8" width="17" height="8" rx="4" fill={fill} /><path d="M12 8v8" stroke={dark} strokeWidth="1.6" /></g>,
    bottle: <g><path d="M9.5 3h5v3l2 3v11a1 1 0 01-1 1h-7a1 1 0 01-1-1V9l2-3z" fill={fill} /><path d="M7.5 13h9" stroke={dark} strokeWidth="1.5" /></g>,
    vial: <g><path d="M9 3h6v4l1.5 3v10a1 1 0 01-1 1h-7a1 1 0 01-1-1V10L9 7z" fill={fill} /><path d="M8.5 3h7" stroke={dark} strokeWidth="1.8" /></g>,
    tube: <g><path d="M8 4h8v2l2 12a2 2 0 01-2 2H8a2 2 0 01-2-2L8 6z" fill={fill} /><path d="M8 4h8" stroke={dark} strokeWidth="2" /></g>,
    inhaler: <g><rect x="7" y="3" width="7" height="9" rx="2" fill={dark} /><path d="M6 12h10a2 2 0 012 2v5a2 2 0 01-2 2H8a2 2 0 01-2-2z" fill={fill} /></g>,
    supp: <g><path d="M12 3c3 3 4.5 6 4.5 9.5S14.5 21 12 21s-4.5-5-4.5-8.5S9 6 12 3z" fill={fill} /></g>,
    sachet: <g><path d="M5 5h14v13a1 1 0 01-1 1H6a1 1 0 01-1-1z" fill={fill} /><path d="M5 8.5h14" stroke={dark} strokeWidth="1.5" /></g>,
  }[shape];
  return (
    <div style={box} title={form || 'Dosage form not recorded'}>
      <svg width={S} height={S} viewBox="0 0 24 24" fill="none">{art}</svg>
    </div>
  );
}

// The photograph if the pharmacy has uploaded one, the glyph if not. `hasImage` rides
// along on every brand row, so this never costs a request for the 21.7k drugs without
// a photo.
function DrugImage({ brand, size, onClick }) {
  const [failed, setFailed] = useState(false);
  const z = size || 46;
  if (!brand) return null;
  if (brand.hasImage && !failed) {
    return (
      <img src={'/api/med/image/' + encodeURIComponent(brand.id)} alt={brand.name}
        onError={() => setFailed(true)} onClick={onClick}
        style={{ width: z, height: z, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: '1px solid ' + MK.LINE, cursor: onClick ? 'zoom-in' : 'default', background: '#fff' }} />
    );
  }
  return <DrugGlyph form={brand.form} name={brand.name} size={z} />;
}

// Resize in the browser before upload. A phone photo is 3-6 MB; the server cap is
// 400 KB, and a 900px JPEG of a medicine strip is entirely legible — so the resize is
// what makes "photograph it with your phone" actually work.
function resizeToDataUri(file, maxPx, quality) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image.'));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);   // flatten PNG transparency
        cx.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality || 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function ImageUploader({ brand, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = useRef(null);
  const pick = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setErr(''); setBusy(true);
    resizeToDataUri(f, 900, 0.82)
      .then((uri) => medApi.put('/api/med/brand/' + brand.id + '/image', { image: uri }))
      .then((r) => {
        setBusy(false);
        if (r && r.ok) { medToast('Photo saved (' + Math.round(r.bytes / 1024) + ' KB)'); onChanged && onChanged(); }
        else setErr((r && r.error) || 'Could not save the photo.');
      })
      .catch((e2) => { setBusy(false); setErr(e2.message || 'Could not process that image.'); });
    e.target.value = '';
  };
  const remove = () => medApi.del('/api/med/brand/' + brand.id + '/image')
    .then(() => { medToast('Photo removed'); onChanged && onChanged(); }).catch(() => {});
  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <button style={MK.btnGhost} disabled={busy} onClick={() => input.current && input.current.click()}>
          <Ic d={I.upload} s={13} />{busy ? 'Uploading…' : (brand.hasImage ? 'Replace photo' : 'Add photo')}
        </button>
        {brand.hasImage ? <button style={{ ...MK.btnGhost, color: '#d23a52' }} onClick={remove}>Remove</button> : null}
      </div>
      {err ? <div style={{ fontSize: 11.5, color: '#d23a52', marginTop: 6 }}>{err}</div> : null}
      <div style={{ fontSize: 10.5, color: MK.FAINT, marginTop: 6, lineHeight: 1.5 }}>
        Photograph the strip or pack. The picture is resized in your browser before it is stored, and it is yours — nothing is fetched from the internet.
      </div>
    </div>
  );
}

/* ================= small shared chips ================= */
// Only shown when the monograph actually states a category (463 of 1711 generics).
// An absent category shows nothing rather than a guess.
const PREG_TONE = { A: 'green', B: 'green', C: 'amber', D: 'red', X: 'red' };
function PregChip({ cat, big }) {
  if (!cat) return null;
  const note = { A: 'no risk shown in studies', B: 'no evidence of risk in humans', C: 'risk cannot be ruled out', D: 'positive evidence of risk', X: 'contraindicated in pregnancy' }[cat] || '';
  return <span style={MK.gchip(PREG_TONE[cat] || 'slate')} title={'Pregnancy category ' + cat + ' — ' + note}>Preg {cat}{big ? ' · ' + note : ''}</span>;
}
const AbxChip = ({ on }) => (on ? <span style={MK.gchip('violet')} title="Antibacterial — counts toward antibiotic stewardship reporting">Antibiotic</span> : null);
function StockChip({ brand }) {
  if (!brand) return null;
  if (brand.preferred) return <span style={MK.gchip('green')} title="Formulary preferred brand">Preferred</span>;
  if (brand.stocked) return <span style={MK.gchip('teal')} title="Stocked by this hospital">In formulary</span>;
  return null;
}

/* ================= favourites & recently viewed =================
 * Per-browser convenience, mirrored into the app-state blob like every other
 * unico_* key (registered in server/access.js KEY_MODULE under 'medicine').
 */
const FAV_KEY = 'unico_med_fav_v1', RECENT_KEY = 'unico_med_recent_v1';
const readLS = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(v) ? v : dflt; } catch (e) { return dflt; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function useFavourites() {
  const [favs, setFavs] = useState(() => readLS(FAV_KEY, []));
  const has = useCallback((id) => favs.some((f) => f.id === id), [favs]);
  const toggle = useCallback((entry) => {
    setFavs((cur) => {
      const next = cur.some((f) => f.id === entry.id) ? cur.filter((f) => f.id !== entry.id) : [entry].concat(cur).slice(0, 60);
      writeLS(FAV_KEY, next);
      return next;
    });
  }, []);
  return { favs, has, toggle };
}
const pushRecent = (entry) => {
  const cur = readLS(RECENT_KEY, []).filter((r) => r.id !== entry.id);
  writeLS(RECENT_KEY, [entry].concat(cur).slice(0, 12));
};
function FavStar({ entry, fav }) {
  const on = fav.has(entry.id);
  return (
    <button onClick={() => fav.toggle(entry)} title={on ? 'Remove from favourites' : 'Save to favourites'}
      style={{ ...MK.btnGhost, padding: '5px 10px', color: on ? '#e0a12a' : MK.MUTED }}>
      <Ic d={I.star} s={14} fill={on ? '#e0a12a' : 'none'} />{on ? 'Saved' : 'Save'}
    </button>
  );
}

/* ================= standalone interaction checker ================= */
function MedInteractions({ setRoute }) {
  const [picked, setPicked] = useState([]);
  const [allergies, setAllergies] = useState('');
  const [q, setQ] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [checked, setChecked] = useState(false);

  const key = picked.map((p) => p.genericId).join(',') + '|' + allergies;
  useEffect(() => {
    const ids = picked.map((p) => p.genericId).filter(Boolean);
    if (!ids.length) { setWarnings([]); setChecked(false); return; }
    const t = setTimeout(() => {
      medApi.post('/api/med/check', { genericIds: ids, allergies })
        .then((r) => { setWarnings((r && r.warnings) || []); setChecked(true); })
        .catch(() => { setWarnings([]); setChecked(true); });
    }, 300);
    return () => clearTimeout(t);
  }, [key]);

  const add = (p) => {
    const d = p.doc;
    const entry = p.kind === 'brand'
      ? { id: d.id, label: d.name + ' ' + (d.strength || ''), generic: d.generic, genericId: d.genericId }
      : { id: d.id, label: d.name, generic: d.name, genericId: d.id };
    if (!entry.genericId) { medToast('That brand has no generic linked, so it cannot be checked.', 'error'); return; }
    setPicked((cur) => cur.concat([entry]));
    setQ('');
  };

  return (
    <div style={MK.page}>
      <div style={cardOpen({ marginBottom: 13 })}>
        <div style={{ padding: '18px 21px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: MK.INK, marginBottom: 3 }}>Interaction checker</div>
          <div style={{ ...MK.sub, marginBottom: 14 }}>
            Add two or more drugs to see what their monographs say about giving them together, plus duplicate-generic and allergy checks.
          </div>
          <DrugSearchBox value={q} onChange={setQ} onPick={add} placeholder="Add a drug to check" />
          {picked.length ? (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 13 }}>
              {picked.map((p, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 9, background: 'rgba(0,144,202,.09)', fontSize: 12, fontWeight: 600, color: MK.INK }}>
                  {p.label}
                  <button onClick={() => setPicked((c) => c.filter((_, n) => n !== i))}
                    style={{ border: 0, background: 'transparent', cursor: 'pointer', color: MK.MUTED, padding: 0, display: 'flex' }}><Ic d={I.x} s={12} /></button>
                </span>
              ))}
              <button style={{ ...MK.btnGhost, padding: '5px 10px', fontSize: 11.5 }} onClick={() => setPicked([])}>Clear all</button>
            </div>
          ) : null}
          <input className="inp" style={{ width: '100%', marginTop: 12 }} placeholder="Known allergies (optional) — e.g. penicillin, sulpha"
            value={allergies} onChange={(e) => setAllergies(e.target.value)} />
        </div>
      </div>

      {picked.length >= 1 ? (
        warnings.length ? <WarningPanel warnings={warnings} acknowledged onAck={() => {}} hideAck />
          : (checked ? (
            <div style={{ ...MK.card, border: '1px solid rgba(31,157,87,.3)' }}>
              <div style={{ padding: '18px 21px', display: 'flex', gap: 11, alignItems: 'center' }}>
                <Ic d={I.check} s={18} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: MK.INK }}>Nothing flagged between these drugs</div>
                  <div style={{ fontSize: 11.5, color: MK.MUTED, marginTop: 2 }}>
                    Their monographs do not mention one another. Absence of a warning is not proof of safety — 24% of generics carry no interaction section at all.
                  </div>
                </div>
              </div>
            </div>
          ) : null)
      ) : (
        <div style={MK.card}><MedEmpty icon={I.activity} title="Add drugs to check" note="Search above. Two or more drugs are needed for an interaction check; one drug plus an allergy is enough for an allergy check." /></div>
      )}
    </div>
  );
}

/* ================= dose calculator =================
 * DELIBERATELY NOT AUTO-FILLED. Only 11% of the monographs state a mg/kg figure in a
 * form a machine could lift out reliably, so the calculator does the arithmetic and
 * shows the drug's own dosage text beside it — the clinician supplies the mg/kg. A
 * calculator that guessed the rate would be the most dangerous thing in this module.
 */
function MedCalc() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [perKg, setPerKg] = useState('');
  const [perDay, setPerDay] = useState('3');
  const [maxDaily, setMaxDaily] = useState('');
  const [q, setQ] = useState('');
  const [gen, setGen] = useState(null);

  const w = parseFloat(weight), r = parseFloat(perKg), n = parseInt(perDay, 10) || 0, hgt = parseFloat(height);
  const daily = (w > 0 && r > 0) ? w * r : null;
  const perDose = (daily != null && n > 0) ? daily / n : null;
  const cap = parseFloat(maxDaily);
  const overCap = (daily != null && cap > 0 && daily > cap);
  // Mosteller: sqrt(height_cm * weight_kg / 3600) — the usual bedside BSA formula.
  const bsa = (w > 0 && hgt > 0) ? Math.sqrt((hgt * w) / 3600) : null;

  const pick = (p) => {
    const id = p.kind === 'generic' ? p.doc.id : p.doc.genericId;
    if (!id) { medToast('No generic linked to that brand.', 'error'); return; }
    medApi.get('/api/med/generic/' + id).then((res) => { if (res && res.ok) setGen(res.generic); }).catch(() => {});
    setQ('');
  };

  return (
    <div style={MK.page}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 14, alignItems: 'start' }} className="med-2col">
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>Weight-based dose</div></div>
          <div style={{ padding: '16px 19px', display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <div><label style={lbl}>Weight (kg)</label><input className="inp" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 14" /></div>
              <div><label style={lbl}>Height (cm, for BSA)</label><input className="inp" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="optional" /></div>
              <div><label style={lbl}>Dose (mg/kg/day)</label><input className="inp" value={perKg} onChange={(e) => setPerKg(e.target.value)} placeholder="from the monograph" /></div>
              <div><label style={lbl}>Doses per day</label>
                <select className="inp" value={perDay} onChange={(e) => setPerDay(e.target.value)}>
                  {[1, 2, 3, 4, 6].map((x) => <option key={x} value={x}>{x} ({['', 'OD', 'BD', 'TDS', 'QDS', '', '6-hourly'][x] || ''})</option>)}
                </select>
              </div>
            </div>
            <div><label style={lbl}>Maximum daily dose (mg, optional)</label><input className="inp" value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} placeholder="adult ceiling, if any" /></div>

            <div style={{ marginTop: 6, padding: '14px 16px', borderRadius: 11, background: overCap ? 'rgba(210,58,82,.07)' : 'rgba(0,144,202,.06)', border: '1px solid ' + (overCap ? 'rgba(210,58,82,.3)' : 'rgba(0,144,202,.15)') }}>
              {daily == null ? <div style={{ fontSize: 12.5, color: MK.MUTED }}>Enter a weight and a mg/kg rate.</div> : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 12, color: MK.MUTED }}>Total daily dose</span>
                    <span style={{ fontSize: 21, fontWeight: 800, fontFamily: MK.MONO, color: overCap ? '#d23a52' : MK.INK }}>{daily.toFixed(1)} mg</span>
                  </div>
                  {perDose != null ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
                      <span style={{ fontSize: 12, color: MK.MUTED }}>Each dose ({n}× daily)</span>
                      <span style={{ fontSize: 17, fontWeight: 800, fontFamily: MK.MONO, color: MK.INK }}>{perDose.toFixed(1)} mg</span>
                    </div>
                  ) : null}
                  {overCap ? <div style={{ fontSize: 12, color: '#d23a52', fontWeight: 700, marginTop: 9 }}>Over the maximum you entered ({cap} mg/day) — reduce the rate or cap the dose.</div> : null}
                </>
              )}
              {bsa != null ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 9, borderTop: '1px solid ' + MK.LINE }}>
                  <span style={{ fontSize: 12, color: MK.MUTED }}>Body surface area (Mosteller)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: MK.MONO, color: MK.INK }}>{bsa.toFixed(2)} m²</span>
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 10.5, color: MK.FAINT, lineHeight: 1.55 }}>
              This is arithmetic, not advice. The mg/kg rate is yours to supply from the monograph or your protocol — the index states a machine-readable rate for only about one drug in ten, so nothing here is filled in for you.
            </div>
          </div>
        </div>

        <div style={cardOpen()}>
          <div style={MK.cardHead}><div style={MK.h3}>Dosage from the monograph</div></div>
          <div style={{ padding: '16px 19px' }}>
            <DrugSearchBox value={q} onChange={setQ} onPick={pick} placeholder="Look up a drug's dosage section" />
            {gen ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: MK.INK }}>{gen.name}</span>
                  <PregChip cat={gen.pregnancyCategory} />
                  <AbxChip on={gen.abx} />
                </div>
                {gen.monograph && gen.monograph.dosage
                  ? <div style={{ fontSize: 12.5, lineHeight: 1.65, color: MK.BODY, maxHeight: 420, overflowY: 'auto' }}><Monograph html={gen.monograph.dosage} /></div>
                  : <div style={{ fontSize: 12.5, color: MK.MUTED }}>No dosage section recorded for this generic.</div>}
                {gen.monograph && gen.monograph.pediatric ? (
                  <div style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid ' + MK.LINE }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: MK.FAINT, marginBottom: 5 }}>Paediatric use</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: MK.BODY }}><Monograph html={gen.monograph.pediatric} /></div>
                  </div>
                ) : null}
              </div>
            ) : <MedEmpty icon={I.doc} title="Search a drug" note="Its dosage and paediatric sections appear here, next to the calculator." />}
          </div>
        </div>
      </div>
    </div>
  );
}
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: MK.MUTED, marginBottom: 4 };

/* ================= prescribing analytics ================= */
function MedAnalytics({ setRoute }) {
  const [d, setD] = useState({ loading: true });
  const [range, setRange] = useState({ from: '', to: '' });
  useEffect(() => {
    setD((x) => ({ ...x, loading: true }));
    medApi.get('/api/med/analytics?' + qs(range)).then((r) => setD({ loading: false, ...r })).catch(() => setD({ loading: false, ok: false }));
  }, [range.from, range.to]);

  if (d.loading) return <div style={MK.page}><div style={{ padding: 40, textAlign: 'center', color: MK.FAINT }}>Building the summary…</div></div>;
  if (!d.ok) return <div style={MK.page}><div style={MK.card}><MedEmpty title="Could not build the summary" /></div></div>;
  if (!d.totals.prescriptions) {
    return <div style={MK.page}><div style={MK.card}><MedEmpty icon={I.trend} title="No prescriptions to analyse yet"
      note="Once prescriptions are written, this shows what is being prescribed, for what, by whom — and the antibiotic share."
      action={<button style={MK.btnPri} onClick={() => setRoute({ view: 'medRxNew' })}>Write one</button>} /></div></div>;
  }
  const max = Math.max(1, ...d.topDrugs.map((x) => x.n));
  const Bar = ({ rows, tone }) => (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: MK.BODY, fontWeight: 600 }}>{r.name}</span>
            <span style={{ fontFamily: MK.MONO, color: MK.MUTED }}>{r.n}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(125,145,180,.14)' }}>
            <div style={{ height: 6, borderRadius: 3, width: Math.round((r.n / Math.max(1, ...rows.map((x) => x.n))) * 100) + '%', background: tone || '#27a8db' }} />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={MK.page}>
      <div style={{ ...MK.card, marginBottom: 13 }}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: MK.MUTED }}>Period</span>
          <input className="inp" type="date" value={range.from} onChange={(e) => setRange((x) => ({ ...x, from: e.target.value }))} style={{ fontSize: 12 }} />
          <span style={{ color: MK.FAINT }}>→</span>
          <input className="inp" type="date" value={range.to} onChange={(e) => setRange((x) => ({ ...x, to: e.target.value }))} style={{ fontSize: 12 }} />
          {range.from || range.to ? <button style={MK.btnGhost} onClick={() => setRange({ from: '', to: '' })}>All time</button> : null}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 13, marginBottom: 13 }}>
        {[
          ['Prescriptions', d.totals.prescriptions],
          ['Drug lines', d.totals.items],
          ['Patients', d.totals.patients],
          ['Contain an antibiotic', d.antibiotics.pct + '%'],
        ].map(([label, val], i) => (
          <div key={i} style={{ ...MK.card, padding: '15px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MK.MUTED, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: i === 3 && d.antibiotics.pct > 30 ? '#d23a52' : MK.INK, fontFamily: MK.MONO }}>{val}</div>
            {i === 3 ? <div style={{ fontSize: 10.5, color: MK.FAINT, marginTop: 3 }}>{d.antibiotics.prescriptions} of {d.antibiotics.of} prescriptions</div> : null}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 13 }}>
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>Most prescribed</div></div>
          <div style={MK.cardBody}><Bar rows={d.topDrugs.slice(0, 12)} /></div>
        </div>
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>Most common diagnoses</div></div>
          <div style={MK.cardBody}>{d.topDiagnoses.length ? <Bar rows={d.topDiagnoses} tone="#2b8f83" /> : <MedEmpty title="No diagnoses recorded" />}</div>
        </div>
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>By prescriber</div></div>
          <div style={MK.cardBody}>{d.byDoctor.length ? <Bar rows={d.byDoctor} tone="#6a52d4" /> : <MedEmpty title="No prescribers recorded" />}</div>
        </div>
        <div style={MK.card}>
          <div style={MK.cardHead}><div style={MK.h3}>By month</div></div>
          <div style={MK.cardBody}>{d.byMonth.length ? <Bar rows={d.byMonth.map((m) => ({ name: m.month, n: m.n }))} tone="#e08a1e" /> : <MedEmpty title="Not enough history yet" />}</div>
        </div>
      </div>
    </div>
  );
}

/* ================= router ================= */
function MedicineView({ view, id, rx, q, setRoute }) {
  useEffect(() => { medInjectStyle(); }, []);
  if (view === 'medInfo' && window.MedicineInfoV2) return <window.MedicineInfoV2 setRoute={setRoute} />;
  if (view === 'medBrowse') return <MedBrowse setRoute={setRoute} initialQ={q} />;
  if (view === 'medBrand') return <MedBrand id={id} setRoute={setRoute} />;
  if (view === 'medGeneric') return <MedGeneric id={id} setRoute={setRoute} />;
  if (view === 'medRxNew') return <RxEditor rxId={rx} seedId={id} setRoute={setRoute} />;
  if (view === 'medRxList') return <MedRxList setRoute={setRoute} />;
  if (view === 'medRxPrint') return <MedRxPrint rxId={rx} setRoute={setRoute} />;
  if (view === 'medTemplates') return <MedTemplates setRoute={setRoute} />;
  if (view === 'medCatalog') return <MedCatalog setRoute={setRoute} />;
  if (view === 'medInteractions') return <MedInteractions setRoute={setRoute} />;
  if (view === 'medCalc') return <MedCalc />;
  if (view === 'medAnalytics') return <MedAnalytics setRoute={setRoute} />;
  return <MedHome setRoute={setRoute} />;
}

// Monograph HTML arrives as bare tags with no classes, so it needs typography of its
// own; the two-column layouts need to stack on a laptop screen.
function medInjectStyle() {
  if (typeof document === 'undefined' || document.getElementById('med-style')) return;
  const el = document.createElement('style');
  el.id = 'med-style';
  el.textContent = [
    '.mono-body ul,.mono-body ol{margin:6px 0 6px 18px;padding:0}',
    '.mono-body li{margin:3px 0}',
    '.mono-body strong{color:#16202e}',
    '.mono-body h4,.mono-body h5{font-size:12.5px;margin:9px 0 4px;color:#16202e}',
    '.mono-body table{border-collapse:collapse;width:100%;margin:7px 0;font-size:11.5px}',
    '.mono-body td,.mono-body th{border:1px solid rgba(125,145,180,.3);padding:4px 7px;text-align:left}',
    '.row-btn:hover{background:rgba(0,144,202,.07)!important}',
    '@media (max-width:1180px){.med-2col{grid-template-columns:minmax(0,1fr)!important}}',
    '@media print{.no-print{display:none!important}}',
  ].join('\n');
  document.head.appendChild(el);
}

Object.assign(window, { MedicineView, DrugSearchBox, medApi });
