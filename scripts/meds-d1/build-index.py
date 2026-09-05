# Rebuild ONLY out/index.json.gz, in the compact v2 format, from the ndjson
# artifacts build.py already wrote. v2 exists because Cloudinary's free plan caps
# a raw upload at 10 MB and the v1 index gzipped to 14 MB: repeated strings
# (manufacturer, class, form, type) are dictionary-encoded and every derivable
# field (nameLower etc.) is dropped — the server recomputes them on load.
import json, gzip, os, time

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')

def nd(name):
    with open(os.path.join(OUT, name), encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]

brands = nd('d1-brands.ndjson')
gens = nd('d1-generics.ndjson')
refs = nd('d1-refs.ndjson')

def dict_of():
    d, order = {}, []
    def idx(v):
        v = v or ''
        if v not in d:
            d[v] = len(order); order.append(v)
        return d[v]
    return idx, order

mfr_i, mfrs = dict_of()
cls_i, classes = dict_of()
form_i, forms = dict_of()
type_i, types = dict_of()

b_rows = [[b['_id'], b['name'], b['generic'], b['genericId'], b['strength'],
           mfr_i(b['manufacturer']), form_i(b['form']), cls_i(b['drugClass']), type_i(b['type']),
           (b['price'] or {}).get('unit'), b['pregnancyCategory'], 1 if b['abx'] else 0,
           b['img'], b['popularity'] or 0] for b in brands]
g_rows = [[g['_id'], g['name'], cls_i(g['drugClass']), g['indication'], g['sections'],
           g['pregnancyCategory'], 1 if g['abx'] else 0, g['brands'],
           [form_i(f) for f in g['forms']]] for g in gens]

# Two parts, because Cloudinary free caps one raw file at 10 MB: part 1 is the
# brand rows alone (the bulk), part 2 is dictionaries + generics + refs.
def write(name, payload):
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    gz = gzip.compress(raw, 9)
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(gz)
    print('%s: raw %.1f MB, gz %.2f MB' % (name, len(raw)/1e6, len(gz)/1e6))

write('index-brands.json.gz', {'v': 2, 'brands': b_rows})
write('index-meta.json.gz', {'v': 2, 'builtAt': time.time(), 'mfrs': mfrs, 'classes': classes,
                             'forms': forms, 'types': types, 'generics': g_rows, 'refs': refs})

# Interactions + food warnings ship as their own CDN asset, not D1 rows: they are
# pure read-only reference data (like the search index), they are needed for EVERY
# drug page and every checker run, and keeping them out of D1 saves ~21k writes on
# each dataset refresh plus a query per lookup.
try:
    ix = nd('d1-interactions.ndjson')
    fw = nd('d1-food.ndjson')
    sev = {'major': 0, 'moderate': 1, 'minor': 2}
    conf = {'high': 0, 'medium': 1, 'low': 2}
    write('index-interactions.json.gz', {
        'v': 1,
        # [gid, interacts_with, severityIdx, reason, advice, confidenceIdx]
        'ix': [[r['gid'], r['with'], sev.get(r['severity'], 1), r['reason'], r['advice'], conf.get(r['confidence'], 1)] for r in ix],
        'food': [[r['gid'], r['warning'], conf.get(r['confidence'], 1)] for r in fw],
    })
    print('%d interactions, %d food warnings' % (len(ix), len(fw)))
except FileNotFoundError:
    print('no interaction artifacts to pack')
print('%d brands, %d generics, %d refs' % (len(b_rows), len(g_rows), len(refs)))
