"""DWELLER — Level VI: THE HEART. The strangest depth: bone-pale stone, veins of light, and a heart
that beats under everything. Every lesson of the descent returns, faster, with fewer tethers."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, build_level

secs = []


def new(name, title, w, hs, e, root):
    s = Sec(name, title, w, hs, dict(e=e, root=root))
    secs.append(s)
    return s


def beat(s, x, y, r, per, on, ph, I=1.2, burn=1.5, warn=0.4):
    """a light that beats like a heart"""
    s.lamp(x, y, r, I, sched=dict(per=int(per * 64), len=int(on * 64), ph=int(ph * 64), warn=int(warn * 64)))
    s.lights[-1]['burnMul'] = burn


# ---------------------------------------------------------------- I THE VALVE
s = new('h0', 'I  THE VALVE', 104, 56, 0.25, 0)
s.cave([(0, 40)], [(0, 14), (16, 16), (90, 14)])
s.spawn_at(6)
s.hint(22, 20, 'THE   HEART   BEATS')
beat(s, 40.5, 31.5, 10, 4, 1.25, 0.0)
beat(s, 66.5, 31.5, 10, 4, 1.25, 2.0)
s.rock(53, 37, 2, 3)

def blank(s, entry, exit_):
    s.floor[0] = entry
    s.floor[s.w - 1] = exit_


# ---------------------------------------------------------------- II THE ATRIUM: right, back left, right again
s = new('h1', 'II  THE ATRIUM', 100, 84, 0.4, 4)
blank(s, 30, 70)
s.air(0, 22, 92, 8)             # upper gallery, heading right
s.air(4, 38, 92, 12)            # middle gallery, heading left
s.air(4, 58, 96, 12)            # lower gallery, heading right
s.air(84, 30, 8, 8)             # a drop from the upper gallery...
s.shelf(84, 30, 8)
s.air(6, 50, 8, 8)              # ...and from the middle one
s.shelf(6, 50, 8)
beat(s, 50.5, 43.5, 30, 2, 1, 0.0, I=1.3, burn=1.5, warn=0.0)
qa = s.hush(80, 30, 10)
s.link(qa)
beat(s, 50.5, 63.5, 30, 2, 1, 1.0, I=1.3, burn=1.5, warn=0.0)
qb = s.hush(18, 50, 10)
s.link(qb)
s.watch(44.5, 22.5, 18, 14, 90, 60, 8, 0.0, I=2.0, burn=2.5)
for wx, wy in ((80, 30), (88, 30), (18, 50), (10, 50), (12, 70)):
    s.way(wx, wy)
s.hint(1, 19, 'THE   HEART   SLEEPS   IF   YOU   FIND   ITS   VALVE')
s.tether(96, 70)

# ---------------------------------------------------------------- III RIBCAGE: up between the ribs, under the eyes
s = new('h2', 'III  RIBCAGE', 56, 104, 0.55, 1)
blank(s, 94, 16)
s.air(0, 86, 8, 8)              # way in
s.air(6, 8, 44, 88)             # the chest
s.air(46, 8, 10, 8)             # way out
s.rock(46, 16, 10, 2)
for k, y in enumerate(range(91, 15, -3)):
    if k % 2 == 0:
        s.shelf(8, y, 22)
    else:
        s.shelf(26, y, 22)
s.way(40, 16)
for k, y in enumerate((74, 50, 26)):
    left = k % 2 == 0
    s.watch(6.5 if left else 49.5, y + 0.5, 40, 10, 0 if left else 180, 22, 10, k * 3.3, I=2.0, burn=1.5)
s.hint(1, 83, 'UP   THROUGH   THE   RIBS')
s.tether(52, 16)

# ---------------------------------------------------------------- IV VENTRICLES: weave between two beating halls
s = new('h3', 'IV  VENTRICLES', 132, 60, 0.55, 5)
blank(s, 26, 36)
s.air(0, 18, 126, 8)            # the upper ventricle, floor 26
s.air(4, 30, 128, 6)            # the lower ventricle, floor 36
for x in (14, 34, 54, 74, 94, 114):
    s.air(x, 26, 4, 4)
    s.shelf(x, 26, 4)           # a valve: drop down through it...
    s.bounce(x, 36, 4, 1)       # ...or drum back up
for k, x in enumerate((24, 44, 64, 84, 104)):
    beat(s, x + 0.5, 21.5, 13, 4, 2, 0.0, I=1.25, burn=1.5)
    beat(s, x + 10.5, 32.5, 13, 4, 2, 2.0, I=1.25, burn=1.5)
s.hint(1, 15, 'WHEN   ONE   BEATS   THE   OTHER   RESTS')
s.tether(128, 36)

# ---------------------------------------------------------------- V CAPILLARIES: the dark way through the maze
s = new('h4', 'V  CAPILLARIES', 104, 60, 0.6, 2)
blank(s, 30, 42)
s.air(0, 28, 30, 2)             # walk in
s.air(28, 28, 2, 14)            # first fork: down...
s.vine(28, 28, 42)
s.air(30, 28, 40, 1)            # ...or crawl straight on
s.air(28, 40, 46, 2)            # the low road
s.air(70, 28, 2, 14)
s.vine(70, 28, 42)
s.air(70, 34, 30, 1)            # a crawl between the roads
s.air(98, 34, 2, 8)
s.air(72, 40, 32, 2)            # out
for k, x in enumerate((40, 54)):
    s.air(x, 14, 2, 14)          # light wells over the crawl
    beat(s, x + 1.0, 15.5, 14, 4, 2, k * 2.0, I=1.3, burn=1.5)
for k, x in enumerate((44, 60)):
    s.air(x, 42, 2, 8)
    beat(s, x + 1.0, 48.5, 10, 4, 2, 1.0 + k * 2.0, I=1.3, burn=1.5)
s.air(82, 20, 2, 14)
beat(s, 83.0, 21.5, 14, 2, 1, 0.0, I=1.3, burn=1.5)
s.hint(1, 25, 'MANY   VESSELS   -   FIND   THE   DARK   ONE')
s.tether(100, 42)

# ---------------------------------------------------------------- VI ARRHYTHMIA: the heart loses its beat
s = new('h5', 'VI  ARRHYTHMIA', 140, 60, 0.7, 3)
s.cave([(0, 42)], [(0, 16), (8, 24), (132, 16)])
s.hint(1, 22, 'THE   BEAT   BREAKS')
for k, (x, per, on, ph) in enumerate(((26, 3, 1.5, 0.0), (48, 5, 2.5, 1.0), (70, 3, 1.0, 2.0), (92, 7, 3.0, 0.0), (114, 5, 2.0, 3.0))):
    beat(s, x + 0.5, 31.5, 16, per, on, ph, I=1.3, burn=1.5, warn=0.5)
for x in (15, 36, 58, 80, 102, 124):
    s.rock(x, 36, 6, 1)          # cover: ribs overhead
s.tether(136, 42)

# ---------------------------------------------------------------- TENDONS: swing across on the cords
s = new('h7', 'TENDONS', 104, 70, 0.8, 1)
s.cave([(0, 40), (8, 64), (96, 40)], [(0, 14), (8, 50), (96, 14)])
s.kills.append((8 * 6, 56 * 6, 96 * 6, 66 * 6))
for k, x in enumerate(range(14, 92, 7)):
    s.vine(x, 18, 46)
    if k % 2 == 1:
        s.plat(x - 1, 47, 3, 1, way=True)   # a knot of gristle to rest on
for k, x in enumerate((24, 45, 66, 87)):
    beat(s, x + 0.5, 22.5, 11, 4, 2, k * 1.0, I=1.25, burn=1.5)
s.hint(1, 20, 'LEAP   FROM   CORD   TO   CORD')
s.tether(100)

# ---------------------------------------------------------------- THE AORTA: down the great vessel with the pulse
s = new('h8', 'THE AORTA', 120, 90, 0.85, 2)
steps = [(0, 24), (15, 30), (30, 36), (45, 42), (60, 48), (75, 54), (90, 60), (105, 66)]
s.cave(steps, [(x, y - 13) for x, y in steps])
for k in range(2):
    s.orbline(6, 18, 108, 42, 10, 8, k * 0.5, 1.3)
    s.lights[-1]['burnMul'] = 1.25
for x, y in steps[1:]:
    s.rock(x - 3, y - 6, 3, 2)   # a lip on each riser to shelter under
s.hint(1, 13, 'THE   PULSE   RUNS   DOWN   THE   VESSEL')
s.tether(114)

# ---------------------------------------------------------------- LUNGS: two breaths up
s = new('h9', 'LUNGS', 70, 100, 0.9, 3)
blank(s, 90, 18)
s.air(0, 82, 8, 8)              # way in
s.air(6, 8, 58, 84)             # the chest
s.air(60, 10, 10, 8)            # way out
s.rock(56, 18, 14, 2)
s.rock(6, 90, 58, 4)
s.vent(14, 44, 90, 5)
s.shelf(20, 50, 30, way=True)
s.vent(46, 10, 50, 5)
for k, (x, y) in enumerate(((30, 72), (34, 34))):
    s.orb(x + 0.5, y, 9, 10, 8, 8, k * 0.5, 1.2)
s.hint(1, 79, 'THE   LUNGS   BREATHE   YOU   UP')
s.tether(66, 18)

# ---------------------------------------------------------------- THE NERVE: crawl between the sparks
s = new('h10', 'THE NERVE', 120, 50, 0.95, 4)
blank(s, 32, 32)
s.air(0, 24, 10, 8)             # way in
s.air(8, 31, 104, 1)            # the nerve
s.air(110, 24, 10, 8)           # way out
for k, x in enumerate((20, 36, 52, 68, 84, 100)):
    s.air(x, 27, 3, 4)          # a hollow to stand in
    s.way(x + 1.5, 32)
for k, x in enumerate((28, 44, 60, 76, 92)):
    beat(s, x + 0.5, 31.5, 7, 2, 0.75, k * 0.4, I=1.3, burn=1.5, warn=0.3)
s.hint(1, 21, 'CRAWL   BETWEEN   THE   SPARKS')
s.tether(116, 32)

# ---------------------------------------------------------------- MARROW: crawl through the bone between the beats
s = new('h11', 'MARROW', 140, 50, 0.95, 4)
s.cave([(0, 32)], [(0, 10)])
for x in (18, 46, 74, 102):
    s.rock(x, 22, 12, 9)         # bone, leaving a crawl at its foot
for k, x in enumerate((37, 65, 93, 121)):
    beat(s, x + 0.5, 25.5, 9, 4, 2, k * 1.0, I=1.3, burn=1.5)
s.hint(1, 19, 'INTO   THE   MARROW')
s.tether(136)

# ---------------------------------------------------------------- SYNAPSES: leap the gaps between the sparks
s = new('h12', 'SYNAPSES', 130, 72, 0.95, 1)
s.cave([(0, 40), (8, 64), (122, 40)], [(0, 14), (8, 48), (122, 14)])
s.kills.append((8 * 6, 56 * 6, 122 * 6, 66 * 6))
for k, x in enumerate(range(8, 118, 12)):
    s.plat(x, 40, 7, 2, way=True)
    if x + 12 < 122:
        s.beam(x + 9.5, 18.5, 5, 24, per=4, on=1.5, ph=k * 0.5, warn=0.5, burn=3.0)
s.hint(1, 18, 'LEAP   BETWEEN   THE   SPARKS')
s.tether(126)

# ---------------------------------------------------------------- VALVE CHAIN: each valve stills the next chamber
s = new('h13', 'VALVE CHAIN', 140, 60, 1.0, 5)
s.cave([(0, 40)], [(0, 14), (8, 22), (132, 14)])
for k in range(4):
    x0 = 6 + 32 * k
    q = s.hush(x0 + 4, 40, 5)
    s.lamp(x0 + 18.5, 30.5, 14, 1.3)
    s.lights[-1]['burnMul'] = 1.5
    s.link(q)
    s.way(x0 + 4, 40)
s.hint(1, 20, 'EACH   VALVE   STILLS   THE   NEXT')
s.tether(136)

# ---------------------------------------------------------------- THE PULSE: drop into the pits as it passes
s = new('h14', 'THE PULSE', 150, 56, 1.0, 3)
s.cave([(0, 40)], [(0, 14), (8, 22), (142, 14)])
for x in range(16, 140, 16):
    s.air(x, 40, 4, 4)          # a pocket in the floor to drop into
    s.way(x + 2, 44)
for k in range(2):
    s.orbline(8, 33, 134, 0, 8, 8, k * 0.5, 1.3)
    s.lights[-1]['burnMul'] = 1.25
s.hint(1, 20, 'DROP   INTO   A   POCKET   AS   THE   PULSE   PASSES')
s.tether(146)

# ---------------------------------------------------------------- VII THE HEART: four valves around the sliver
s = new('h6', 'VII  THE HEART', 110, 96, 1.0, 0)
blank(s, 80, 20)
s.air(0, 72, 8, 8)              # way in
s.air(6, 10, 98, 78)            # the heart
s.kills.append((6 * 6, 86 * 6, 104 * 6, 92 * 6))
s.rock(6, 80, 22, 2)            # the floor you enter on
# two valves: one stills the low chambers, one the high; between them a bridge, a drum and a ledge
s.rock(8, 70, 14, 2)            # the first valve's ledge, a drum's throw above the floor
s.bounce(22, 80, 4, 1)
s.rock(28, 72, 52, 2)           # the bridge, under the low chambers
s.bounce(76, 72, 4, 1)
s.rock(80, 60, 20, 2)           # the second valve's ledge
s.shelf(72, 58, 4)
q1, q2 = s.hush(14, 70, 12), s.hush(90, 60, 9)
beat(s, 40.5, 64.5, 22, 2, 1, 0.0, I=1.3, burn=1.75, warn=0.0)
beat(s, 70.5, 64.5, 22, 2, 1, 1.0, I=1.3, burn=1.75, warn=0.0)
s.link(q1, 2)
beat(s, 52.5, 33.5, 22, 2, 1, 0.0, I=1.3, burn=1.75, warn=0.0)
beat(s, 66.5, 37.5, 22, 2, 1, 1.0, I=1.3, burn=1.75, warn=0.0)
s.link(q2, 2)
# the sliver floats in the middle on a pillar of bone
s.rock(50, 52, 12, 2)
s.rock(54, 50, 4, 2)
s.shelf(42, 56, 6)
s.shelf(64, 56, 6)
s.lamp(56.0, 43.5, 24, 1.0, col='shard', haz=False)
s.goal_at(56.0, 47.0)
for wx, wy in ((14, 70), (78, 60), (90, 60)):
    s.way(wx, wy)
s.hint(1, 69, 'TWO   VALVES   -   THE   HEART   STILLS   FOR   A   MOMENT')

META = dict(idx=5, name='THE HEART', theme='heart')

if __name__ == '__main__':
    build_level(secs, META)
