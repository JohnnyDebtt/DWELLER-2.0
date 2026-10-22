"""DWELLER — THE CODEX: the Guardian's arena after the Core is won.

A copy of level VII (build/level7.json, which is never changed) with the fight taken out: no Guardian, no lights,
the plug under the pedestal broken open into the way down to The Deep. 35 places for seekers in three bands (the top
for tiers S and A in The Deep, B in the middle, C and D at the bottom), a pedestal by the hole for your newest find, the six slivers, and the
empty shell where the Guardian hung, with the space around it left open.
Writes build/level8.json.        ARCH=galleries|balconies|ledges python3 tools/archive.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TS = 6
L = json.load(open(os.path.join(ROOT, 'build', 'level7.json')))
W, H = L['w'], L['h']
VARIANT = os.environ.get('ARCH', 'balconies')

g = []
for y in range(H):
    row, v = [], 0
    for n in L['rows'][y]:
        row += [v] * n
        v ^= 1
    g.append(row)

# the plug is gone: the floor stays open where the Guardian broke it
for f in L['fakes']:
    for y in range(f[1], f[1] + f[3]):
        for x in range(f[0], f[0] + f[2]):
            g[y][x] = 0

core = next(l for l in L['lights'] if l['t'] == 'gcore')
fight_alcoves = [None] * 6
for l in L['lights']:
    if l['t'] == 'alcove':
        fight_alcoves[l['n']] = [l['x'], l['y']]

oneway, vents = [], []
IN_X0, IN_X1, TOP, FLOOR_ROW = 70, 208, 12, 92          # the arena's inside: columns 70..207, rows 12..91


def rock(x, y, w, h=1):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            g[yy][xx] = 1


def clear():
    for y in range(TOP, FLOOR_ROW):
        for x in range(IN_X0, IN_X1):
            g[y][x] = 0


def shelf(x0, x1, y):
    """a long shelf: jump up through it, stand on it, press down to drop through"""
    for x in range(x0, x1):
        g[y][x] = 0
    oneway.append([x0, y, x1 - x0])


def vent(x, y0, y1, w):
    vents.append([x, y0, w, y1 - y0])


def spread(x0, x1, n, y):
    step = (x1 - x0) / (n - 1) if n > 1 else 0
    return [(round(x0 + step * i, 1), y) for i in range(n)]


if VARIANT == 'galleries':
    clear()
    # three long galleries; the middle one parts around the Guardian's shell
    shelf(72, 206, 30)
    shelf(72, 125, 52); shelf(153, 206, 52)
    shelf(72, 206, 72)
    # hot air: two lifts the whole height at the ends, two short ones up to the lowest gallery
    vent(72, 24, 92, 4); vent(202, 24, 92, 4)
    vent(104, 66, 92, 4); vent(171, 66, 92, 4)
    HIGH = spread(82, 196, 11, 30)
    WALL = spread(80, 117, 6, 52) + spread(161, 198, 6, 52)
    FLOOR = [p for p in spread(80, 198, 13, 72) if abs(p[0] - 139) > 4][:12]
    # the slivers flank the shell on every gallery
    alcoves = [[128 * TS, 72 * TS], [150 * TS, 72 * TS], [122 * TS, 52 * TS], [156 * TS, 52 * TS], [128 * TS, 30 * TS], [150 * TS, 30 * TS]]
elif VARIANT == 'balconies':
    clear()
    # two towers of balconies against the walls, six tiers each, facing the shell across the open middle
    rows = [20, 32, 44, 56, 68, 80]
    for y in rows:
        shelf(72, 101, y); shelf(177, 206, y)
    vent(72, 14, 92, 4); vent(202, 14, 92, 4)
    left = lambda y, n: [(80 + i * 7, y) for i in range(n)]
    right = lambda y, n: [(198 - i * 7, y) for i in range(n)]
    HIGH = left(20, 3) + right(20, 3) + left(32, 3) + right(32, 2)
    WALL = left(44, 3) + right(44, 3) + left(56, 3) + right(56, 3)
    FLOOR = left(68, 3) + right(68, 3) + left(80, 3) + right(80, 3)
    alcoves = [[100 * TS, 20 * TS], [178 * TS, 32 * TS], [100 * TS, 44 * TS], [178 * TS, 56 * TS], [100 * TS, 68 * TS], [178 * TS, 80 * TS]]
else:
    # the first layout: shelves grown among the fight's own ledges
    for x, y, w in [(84, 25, 4), (108, 24, 4), (130, 25, 4), (158, 24, 4), (188, 24, 4)]:
        rock(x, y, w)
    HIGH = [(98, 18), (102, 18), (121.5, 18), (145, 18), (169.5, 18), (178.5, 18),
            (85.5, 25), (109.5, 24), (131.5, 25), (159.5, 24), (189.5, 24)]
    WALL = [(72, 36), (80.5, 36), (90.5, 36), (109.5, 42), (117.5, 54), (125.5, 66), (118.5, 30),
            (197, 30), (197, 46), (197, 62), (203, 38), (203, 54)]
    FLOOR = [(76, 92), (96, 92), (103, 92), (112.5, 85), (119, 92), (150, 92), (157, 92), (164, 92),
             (170.5, 85), (182, 92), (192, 92), (85, 85)]
    alcoves = fight_alcoves

# a glass bridge over the Guardian's hole: walk across it, press down to drop through into The Deep
if VARIANT == 'balconies':
    oneway.append([134, FLOOR_ROW, 11])

# the pedestal for the newest find, at the edge of the hole
rock(127, 91, 4, 1)
ow = set((x, y) for (x0, y, w) in oneway for x in range(x0, x0 + w))
for band in (HIGH, WALL, FLOOR):
    for (x, y) in band:
        assert (g[y][int(x)] == 1 or (int(x), y) in ow) and g[y - 1][int(x)] == 0 and g[y - 2][int(x)] == 0, (x, y)


def px(p):
    return [round(p[0] * TS, 2), p[1] * TS]


rows = []
for y in range(H):
    runs, cur, n = [], 0, 0
    for x in range(W):
        v = g[y][x]
        if v == cur:
            n += 1
        else:
            runs.append(n)
            cur, n = v, 1
    runs.append(n)
    rows.append(runs)

A = dict(L)
A.update(rows=rows, tiles=dict(oneway=oneway, bounce=[], ice=[]), vents=vents, vines=[], lights=[], checks=[], hints=[],
         fakes=[], kills=[], ways=[], switches=[], name='THE CODEX', idx=7,
         archive=dict(core=[core['x'], core['y']], alcoves=alcoves, high=[px(p) for p in HIGH], wall=[px(p) for p in WALL],
                      floor=[px(p) for p in FLOOR], pedestal=px((128.8, 91)), hole=[134 * TS, 145 * TS, 92 * TS], exit=3 * TS,
                      layout=VARIANT))
A.pop('final', None)
A['sections'] = [dict(name='a0', title='THE CODEX', x0=0, x1=W, music=dict(e=0.1, root=0))]
open(os.path.join(ROOT, 'build', 'level8.json'), 'w').write(json.dumps(A, separators=(',', ':')))
print('archive', VARIANT, W, 'x', H, 'places', len(HIGH) + len(WALL) + len(FLOOR))
