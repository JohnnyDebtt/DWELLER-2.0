"""Every SEEKER NET seeker, ready for the game: one sheet with all 2,222 portraits (54 x 54 each, in token order,
48 to a row, drawn from the collection's own layers with its engine) and a small table of every token's traits.
    python3 -I tools/seekernet.py <path to collections/SEEKER_NET>
writes assets/seeker/net.png and assets/seeker/net.json"""
import sys, os, csv, json
C = os.path.abspath(sys.argv[1]); OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'seeker')
sys.path.insert(0, os.path.join(C, 'engine'))
os.chdir(C)
import final as F
from PIL import Image
rows = list(csv.DictReader(open('lists/tokens.csv')))
rows.sort(key=lambda r: int(r['token']))
assert [int(r['token']) for r in rows] == list(range(1, len(rows) + 1))
COLS = 48
at = Image.new('RGBA', (COLS * 54, (len(rows) + COLS - 1) // COLS * 54), (0, 0, 0, 0))
# the same seekers with their eyes shut: only the pixels that differ, in the colour they have without eyes
lids = Image.new('RGBA', at.size, (0, 0, 0, 0))
KEYS = ['Base', 'Colorway', 'Eyes', 'Floating Object', 'Head', 'Flank', 'Back', 'Background']
names = {k: [] for k in KEYS}
codes = []
A = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
for i, r in enumerate(rows):
    t = {k: (None if r[k] == 'None' else r[k]) for k in F.KEYS}
    full = F.compose(t, background=(0, 0, 0, 0)).convert('RGBA')
    at.paste(full, ((i % COLS) * 54, (i // COLS) * 54))
    bare = F.compose(t, background=(0, 0, 0, 0), eyes=False).convert('RGBA')
    fp, bp = full.load(), bare.load()
    for y in range(54):
        for x in range(54):
            if fp[x, y] != bp[x, y]:
                c = bp[x, y]
                lids.putpixel(((i % COLS) * 54 + x, (i // COLS) * 54 + y), c if c[3] else (0, 0, 0, 0))
    c = ''
    for k in KEYS:
        v = r[k]
        if v not in names[k]: names[k].append(v)
        c += A[names[k].index(v)]
    codes.append(c)
px = list(at.getdata()); cs = sorted(set(px)); idx = {c: k for k, c in enumerate(cs)}
p = Image.new('P', at.size); p.putpalette([v for c in cs for v in c[:3]] + [0] * (768 - 3 * len(cs)))
p.putdata([idx[c] for c in px])
p.save(os.path.join(OUT, 'net.png'), optimize=True, transparency=bytes([c[3] for c in cs]))
lp = list(lids.getdata()); lc = sorted(set(lp)); li = {c: k for k, c in enumerate(lc)}
q = Image.new('P', lids.size); q.putpalette([v for c in lc for v in c[:3]] + [0] * (768 - 3 * len(lc)))
q.putdata([li[c] for c in lp]); q.save(os.path.join(OUT, 'net_lids.png'), optimize=True, transparency=bytes([c[3] for c in lc]))
print('lids colours', len(lc))
cw = json.load(open('layers/colorways.json'))['colorways']
rare = sorted(([int(r['token']), int(r['charge_rank'])] for r in rows if int(r['charge_rank']) < 222), key=lambda q: q[1])
ranks = [int(r['charge_rank']) for r in rows]
json.dump({'cols': COLS, 'rare': rare, 'rank': ranks, 'keys': KEYS, 'names': names, 'cw': cw, 't': codes}, open(os.path.join(OUT, 'net.json'), 'w'), separators=(',', ':'))
print(len(rows), 'seekers,', len(cs), 'colours')
