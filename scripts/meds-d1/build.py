# Build the D1 + Cloudinary artifacts from the "final drug update list" SQLite.
#
# Reads:  C:\final durg update list\data\medicines.db   (138,853 rows)
# Writes: scripts\meds-d1\out\
#   d1-brands.ndjson    one light row per brand (for the D1 meds_brand table)
#   d1-generics.ndjson  one row per generic with a gzip+base64 monograph blob
#   d1-refs.ndjson      class / manufacturer / form reference rows with counts
#   index.json.gz       the in-memory search index the server loads on cold start
#   images-manifest.txt "<hash-file>\t<brand-id>" for the Cloudinary uploader
#
# SHAPES ARE THE APP'S OWN (scripts/import-medicines.js): the client is not
# touched, so brand/generic/ref docs here carry exactly the fields the existing
# /api/med endpoints project. The monograph is GENERIC-level (how the app has
# always worked): each generic takes the monograph of its best member -
# clinical_content_confidence high > medium > low, then best popularity rank.
import sqlite3, json, gzip, base64, hashlib, os, re, sys

SRC = r'C:\final durg update list\data\medicines.db'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)

norm = lambda v: re.sub(r'\s+', ' ', str(v or '').strip().lower())[:200]
clean = lambda v: str(v or '').strip()
h16 = lambda v: hashlib.md5(v.encode('utf-8')).hexdigest()[:16]

CONF_RANK = {'high': 0, 'medium': 1, 'low': 2}
MONO_MAP = [  # app monograph key <- source column
    ('indication', 'indications'), ('pharmacology', 'pharmacology'), ('dosage', 'dosage_text'),
    ('administration', 'administration'), ('interaction', 'interactions'),
    ('contraindications', 'contraindications'), ('sideEffects', 'side_effects'),
    ('pregnancy', 'pregnancy_lactation'), ('precautions', 'precautions'),
    ('overdose', 'overdose'), ('storage', 'storage_conditions'),
    ('therapeuticClass', None),  # filled from therapeutic_class below
    # bonus sections the new dataset adds; harmless extras for the client
    ('adultDose', 'adult_dose'), ('childDose', 'child_dose'), ('renalDose', 'renal_dose'),
    ('nursingConsiderations', 'nursing_considerations'), ('prescriberConsiderations', 'prescriber_considerations'),
    ('mechanism', 'mechanism_of_action'), ('packaging', 'packaging'), ('description', 'description'),
]

# therapeutic_class is meant to be a SHORT label (it becomes a chip, a browse filter
# and a category count) but ~2.4% of source rows put a whole paragraph there, which
# an uncapped chip turns into a broken layout. Salvage a real label when one is
# recoverable, otherwise leave it blank — the full prose still ships as the
# "Therapeutic class" monograph section, where long text belongs.
CLASS_LEAD = re.compile(r'^.{0,60}?\bbelongs to\s+(?:the\s+)?(?:following\s+)?(?:categor(?:y|ies)|therapeutic\s+class(?:es)?|class(?:es)?|group)\s*(?:of\s+|:\s*)?', re.I)
CLASS_MAX = 70
CLASS_INFIX = re.compile(r'^.{0,60}?\bbelongs to\s+(?:the\s+)?(.{3,70}?)\s+(?:class|categor(?:y|ies)|group)\b', re.I)
# Words that are never a class on their own — without this, "belongs to the
# therapeutic class of ..." yields the label "therapeutic".
CLASS_FILLER = {'therapeutic', 'the', 'a', 'an', 'drug', 'drugs', 'medicine', 'medicines',
                'following', 'same', 'this', 'its', 'category', 'class', 'group', 'combination'}
def _ok(c):
    c = c.strip(' .;,-—')
    return c if (3 <= len(c) <= CLASS_MAX and c.lower() not in CLASS_FILLER) else ''
def clean_class(v):
    s = clean(v)
    if not s or len(s) <= CLASS_MAX:
        return s
    cands = []
    lead = CLASS_LEAD.sub('', s).strip()          # "...class of <LABEL>, ..." -> LABEL...
    if lead and lead != s:
        cands.append(lead)
    m = CLASS_INFIX.match(s)                      # "...the <LABEL> class, ..."  -> LABEL
    if m:
        cands.append(m.group(1))
    cands.append(s)                               # last resort: the first clause of the prose
    for c in cands:
        got = _ok(c)
        if got:
            return got
        for sep in (';', '. ', ' — ', ', ', ',', ' ('):
            got = _ok(c.split(sep)[0])
            if got:
                return got
    return ''          # not a label — don't let prose masquerade as one

def preg_cat(text):
    m = re.search(r'category\s+([A-DX])\b', str(text or ''), re.I)
    return m.group(1).upper() if m else ''

db = sqlite3.connect(SRC)
db.row_factory = sqlite3.Row
rows = db.execute('select * from medicines').fetchall()
print('source rows:', len(rows))

gens = {}       # nameLower -> {best row, agg}
brands = []
img_manifest = []
counts = {'class': {}, 'mfr': {}, 'form': {}}

for r in rows:
    gname = clean(r['generic_name']) or clean(r['brand_name'])
    gl = norm(gname)
    gid = 'gen-' + h16(gl)
    bid = 'b-' + h16(r['unique_id'])
    form = clean(r['dosage_form'])
    mfr = clean(r['manufacturer'])
    cls = clean_class(r['therapeutic_class'])
    price = r['current_price_bdt']
    img = clean(r['local_image_file'])
    cat = norm(r['category'])
    btype = 'allopathic' if cat in ('allopathy', 'allopathic', '') else cat  # herbal / unani / ayurvedic kept as-is

    g = gens.get(gl)
    if g is None:
        g = gens[gl] = {'id': gid, 'name': gname, 'best': None, 'bestKey': (9, 10**9),
                        'brands': 0, 'forms': set(), 'mfrs': set(), 'cls': {}}
    key = (CONF_RANK.get(norm(r['clinical_content_confidence']), 3), r['popularity_rank'] or 10**9)
    if key < g['bestKey']:
        g['bestKey'] = key; g['best'] = r
    g['brands'] += 1
    if form: g['forms'].add(form)
    if mfr: g['mfrs'].add(mfr)
    if cls: g['cls'][cls] = g['cls'].get(cls, 0) + 1

    if cls: counts['class'][cls] = counts['class'].get(cls, 0) + 1
    if mfr: counts['mfr'][mfr] = counts['mfr'].get(mfr, 0) + 1
    if form: counts['form'][form] = counts['form'].get(form, 0) + 1
    if img: img_manifest.append(img + '\t' + bid)

    brands.append({
        '_id': bid, 'name': clean(r['brand_name']), 'nameLower': norm(r['brand_name']),
        'type': btype, 'slug': clean(r['unique_id']), 'form': form,
        'generic': gname, 'genericId': gid, 'genericLower': gl,
        'strength': clean(r['strength']), 'manufacturer': mfr, 'manufacturerLower': norm(mfr),
        'drugClass': cls, 'pregnancyCategory': preg_cat(r['pregnancy_lactation']),
        'abx': bool(r['antibiotic']),
        'price': ({'unit': price, 'unitLabel': 'Unit Price'} if price is not None else None),
        'priceMin': r['price_min_bdt'], 'priceMax': r['price_max_bdt'],
        'popularity': r['popularity_rank'],
        'hasImage': bool(img), 'img': img,
        'confidence': clean(r['clinical_content_confidence']), 'needsReview': bool(r['needs_review']),
        'source': 'bd-drug-2026', 'sourceDate': '2026-09',
    })

print('generics:', len(gens))

plain = lambda v: re.sub(r'<[^>]+>', ' ', str(v or '')).strip()
gen_out = []
for gl, g in gens.items():
    r = g['best']
    mono = {}
    for key, col in MONO_MAP:
        v = clean(r['therapeutic_class'] if col is None else r[col])
        if v: mono[key] = v
    bn = {}
    for k in ['bn_indications', 'bn_side_effects', 'bn_dosage_text', 'bn_contraindications', 'bn_precautions', 'bn_storage_conditions']:
        v = clean(r[k])
        if v: bn[k[3:]] = v
    if bn: mono['bn'] = bn
    top_cls = max(g['cls'].items(), key=lambda kv: kv[1])[0] if g['cls'] else ''
    doc = {
        '_id': g['id'], 'name': g['name'], 'nameLower': gl, 'slug': g['id'],
        'drugClass': top_cls, 'indication': plain(r['indications'])[:220],
        'monograph': mono, 'sections': len(mono),
        'brief': {
            'dosage': plain(r['dosage_text'])[:1200], 'interaction': plain(r['interactions'])[:1200],
            'contra': plain(r['contraindications'])[:1200], 'pregnancy': plain(r['pregnancy_lactation'])[:600],
        },
        'pregnancyCategory': preg_cat(r['pregnancy_lactation']), 'abx': bool(r['antibiotic']),
        'brands': g['brands'], 'forms': sorted(g['forms']), 'manufacturers': len(g['mfrs']),
        'confidence': clean(r['clinical_content_confidence']),
        'source': 'bd-drug-2026', 'sourceDate': '2026-09',
    }
    gen_out.append(doc)

refs = []
for kind, m in counts.items():
    for name, n in m.items():
        refs.append({'_id': kind + '-' + h16(norm(name)), 'kind': kind, 'name': name, 'nameLower': norm(name), 'count': n})

# ---- write artifacts ----
def nd(path, docs, blob_key=None):
    with open(os.path.join(OUT, path), 'w', encoding='utf-8') as f:
        for d in docs:
            f.write(json.dumps(d, ensure_ascii=False) + '\n')
    print('wrote', path, len(docs))

# generics carry the monograph as gz+base64 (goes into a D1 BLOB-ish TEXT column)
for d in gen_out:
    heavy = {'monograph': d.pop('monograph'), 'brief': d.pop('brief')}
    d['mono_gz'] = base64.b64encode(gzip.compress(json.dumps(heavy, ensure_ascii=False).encode('utf-8'), 6)).decode('ascii')

nd('d1-brands.ndjson', brands)
# Brands also go out PACKED, 24 docs per row ('bpk-N') - D1's free tier counts
# every ROW written per day, and 118k single rows burned a whole day's quota by
# themselves. The server resolves id -> pack from the index position (the index
# and this file share the same order), so reads stay one small row.
packs = []
for i in range(0, len(brands), 24):
    packs.append({'_id': 'bpk-' + str(i // 24), 'docs': brands[i:i + 24]})
nd('d1-brand-packs.ndjson', packs)
nd('d1-generics.ndjson', gen_out)
nd('d1-refs.ndjson', refs)

# Structured interaction + food-warning tables (new in the 2026-09-05 dataset).
# Keyed to our generic id ('gen-' + h16(norm(generic_name))) so the checker and the
# detail page look them up by the id they already hold.
try:
    ix = []
    for i, r in enumerate(db.execute('select generic_name, interacts_with, severity, reason, advice, confidence from drug_interactions')):
        gid = 'gen-' + h16(norm(r[0]))
        ix.append({'_id': 'ix-' + str(i), 'gid': gid, 'generic': clean(r[0]), 'with': clean(r[1]),
                   'severity': norm(r[2]), 'reason': clean(r[3]), 'advice': clean(r[4]), 'confidence': norm(r[5])})
    nd('d1-interactions.ndjson', ix)
    fw = []
    for i, r in enumerate(db.execute('select generic_name, warning, confidence from drug_food_warnings')):
        gid = 'gen-' + h16(norm(r[0]))
        fw.append({'_id': 'fx-' + str(i), 'gid': gid, 'generic': clean(r[0]), 'warning': clean(r[1]), 'confidence': norm(r[2])})
    nd('d1-food.ndjson', fw)
except Exception as e:
    print('no interaction tables in this source:', e)

# SUPERSEDED by build-index.py's split v2 assets (index-brands / index-meta), which
# are what the server actually loads. The single-file v1 index below is kept only
# behind --v1-index: at 43 MB raw it now blows the gzip buffer on this machine, and
# nothing reads it.
if '--v1-index' not in sys.argv:
    with open(os.path.join(OUT, 'images-manifest.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(img_manifest))
    print('wrote images-manifest.txt', len(img_manifest))
    gz_total = sum(len(d['mono_gz']) for d in gen_out)
    print('generic mono blobs (base64): %.1f MB' % (gz_total / 1e6))
    raise SystemExit(0)

# search index: everything the list/search/browse/analytics endpoints project
idx = {
    'builtAt': __import__('time').time(),
    'brands': [[b['_id'], b['name'], b['nameLower'], b['generic'], b['genericId'], b['genericLower'],
                b['strength'], b['form'], b['manufacturer'], b['manufacturerLower'], b['drugClass'],
                b['type'], (b['price'] or {}).get('unit'), b['pregnancyCategory'], 1 if b['abx'] else 0,
                1 if b['hasImage'] else 0, b['img'], b['popularity'] or 0] for b in brands],
    'generics': [[g['_id'], g['name'], g['nameLower'], g['drugClass'], g['indication'], g['sections'],
                  g['pregnancyCategory'], 1 if g['abx'] else 0, g['brands'], g['forms']] for g in gen_out],
    'refs': refs,
}
raw = json.dumps(idx, ensure_ascii=False).encode('utf-8')
with open(os.path.join(OUT, 'index.json.gz'), 'wb') as f:
    f.write(gzip.compress(raw, 9))
print('wrote index.json.gz  raw %.1f MB  gz %.1f MB' % (len(raw)/1e6, os.path.getsize(os.path.join(OUT, 'index.json.gz'))/1e6))

with open(os.path.join(OUT, 'images-manifest.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(img_manifest))
print('wrote images-manifest.txt', len(img_manifest))

# size projections
gz_total = sum(len(d['mono_gz']) for d in gen_out)
print('generic mono blobs (base64): %.1f MB' % (gz_total/1e6))
