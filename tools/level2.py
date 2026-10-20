"""DWELLER — Level II: THE MYCELIUM. A fungal deep you climb rather than cross: up a ladder of gill
shelves, over a canopy of bouncing caps, along hanging hyphae, then down through the spore shafts
to the mother cap. The caps breathe light on a slow beat. A false wall hides a dormant SEEKER."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, build_level

secs = []


def new(name, title, w, hs, e, root):
    s = Sec(name, title, w, hs, dict(e=e, root=root))
    secs.append(s)
    return s


def cap(s, x, floor, r, per, on, ph, I=1.1, warn=0.75):
    """a glowcap: a breathing light on a short stalk"""
    s.lamp(x, floor - 1.5, r, I, sched=dict(per=int(per * 64), len=int(on * 64), ph=int(ph * 64), warn=int(warn * 64)), col='cap')


def breathe(s, x, y, r, per, on, ph, I=1.1):
    s.lamp(x, y, r, I, sched=dict(per=int(per * 64), len=int(on * 64), ph=int(ph * 64), warn=48))


# ---------------------------------------------------------------- I SPOREFALL: the first cap that bounces
s = new('m0', 'I  SPOREFALL', 76, 60, 0.15, 0)
s.cave([(0, 44), (46, 34)], [(0, 16), (46, 18)])
s.spawn_at(5)
s.hint(4, 24, 'THE   CAPS   BREATHE')
cap(s, 18.5, 44, 10, 6, 3, 0)
cap(s, 30.5, 44, 10, 6, 3, 3)
s.bounce(38, 44, 5)
s.hint(22, 18, 'HOLD   JUMP   AS   YOU   LAND   ON   A   CAP')
s.way(48, 34)
cap(s, 60.5, 34, 9, 6, 3, 1)
s.tether(70)

# ---------------------------------------------------------------- II GILL LADDER: up a hollow stalk
s = new('m1', 'II  GILL LADDER', 42, 92, 0.25, 4)
s.cave([(0, 82), (34, 16)], [(0, 8), (8, 70), (34, 8)])
s.hint(1, 70, 'UP')
rows = list(range(79, 15, -3))
for k, y in enumerate(rows):
    if k % 2 == 0:
        s.shelf(9, y, 10, way=True)
    else:
        s.shelf(23, y, 11, way=True)
for k, y in enumerate((70, 52, 34)):
    breathe(s, 21.5, y + 0.5, 12, 8, 3, k * 8 / 3.0)
s.tether(38)

# ---------------------------------------------------------------- III THE CANOPY: bounce from cap to cap
s = new('m2', 'III  THE CANOPY', 128, 72, 0.4, 1)
s.cave([(0, 30), (6, 62), (118, 30)], [(0, 14), (6, 50), (118, 18)])
s.kills.append((6 * 6, 47 * 6, 118 * 6, 64 * 6))
course = [('b', 10, 36), ('p', 20, 30), ('b', 30, 36), ('p', 41, 28), ('b', 51, 37), ('p', 62, 30),
          ('b', 72, 36), ('b', 84, 36), ('p', 96, 30), ('b', 106, 37)]
for kind, x, y in course:
    if kind == 'b':
        s.bounce(x, y, 5, 2)
    else:
        s.plat(x, y, 6, 2, way=True)
for k, (x, y) in enumerate([(25, 22), (46, 20), (78, 22), (101, 22)]):
    s.orb(x + 0.5, y, 8, 6, 3, 8, k * 0.25, 1.2)
cap(s, 43.5, 28, 9, 8, 3, 0)
cap(s, 98.5, 30, 9, 8, 3, 4)
s.tether(64, 30)
# the secret: a hypha hangs into a slot in the ceiling; a false wall waits at its top
s.vine(68, 6, 30)
s.fake(69, 6, 10, 5)
s.secret_at(75.5, 11)
s.hint(48, 8, 'NOT   EVERY   WALL   IS   STONE')

# ---------------------------------------------------------------- IV HYPHAE: leap from strand to strand
s = new('m3', 'IV  HYPHAE', 92, 72, 0.45, 5)
s.cave([(0, 30), (8, 62), (82, 30)], [(0, 14), (8, 48), (82, 14)])
s.kills.append((8 * 6, 47 * 6, 82 * 6, 64 * 6))
s.hint(1, 13, 'HOLD   UP   TO   CLIMB  -  JUMP   TO   LEAP')
for x in (14, 22, 30, 38, 54, 62, 70, 77):
    s.vine(x, 14, 34)
s.plat(44, 30, 6, 2, way=True)
for k, x in enumerate((26, 34, 58, 66)):
    s.orbline(x + 0.5, 15, 0, 16, 7, 8, k * 0.25, 1.2)
breathe(s, 46.5, 20.5, 11, 8, 3, 2)
s.tether(86)

# ---------------------------------------------------------------- V SPORE TIDE: high and fast, or low and dark
s = new('m4', 'V  SPORE TIDE', 112, 72, 0.4, 2)
s.floor[0] = 30
s.floor[111] = 30
s.air(0, 22, 12, 8)             # way in
s.air(10, 14, 88, 38)           # the cavern; its floor is row 52
s.air(96, 22, 16, 8)            # way out, high on the right
s.rock(96, 30, 16, 22)
s.rock(96, 30, 4, 2)
s.air(96, 30, 4, 2)
s.rock(96, 32, 4, 20)           # the step below the way out (top row 32)
# the high road: gill shelves under the breathing caps
for (x, y) in [(14, 27), (23, 25), (32, 23), (42, 22), (52, 22), (62, 22), (72, 23), (81, 25), (89, 28)]:
    s.shelf(x, y, 6)
for k, x in enumerate((36.5, 60.5, 84.5)):
    breathe(s, x, 17.5, 12, 8, 3, k * 2.67)
# the low road: a long dark crawl under a fallen cap, and two caps that throw you home
s.rock(36, 46, 34, 5)           # crawl row 51
s.orbline(14, 47, 16, 0, 7, 8, 0.0, 1.1)
s.bounce(78, 52, 5, 1)
s.plat(85, 42, 6, 2, way=False)
s.bounce(85, 42, 5, 1)
s.hint(14, 12, 'HIGH   AND   FAST  -  OR   LOW   AND   DARK')
s.tether(106, 30)

# ---------------------------------------------------------------- VI SPORE SHAFTS: drop through the gills
s = new('m5', 'VI  SPORE SHAFTS', 44, 100, 0.55, 3)
s.cave([(0, 20), (8, 90), (30, 90)], [(0, 10), (8, 80), (30, 10)])
s.hint(1, 7, 'DOWN   TO   DROP   THROUGH')
for k, y in enumerate((30, 40, 50, 60, 70, 80)):
    s.shelf(8, y, 22, way=False)
    s.way(19, y)
for k, y in enumerate((35, 45, 55, 65, 75)):
    s.air(4, y - 1, 4, 3)
    s.beam(5.5, y + 0.5, 3, 26, per=8, on=4, ph=k * 1.6, ang=0, chimney=False, burn=1.5)
s.way(36, 90)
s.tether(38)

# ---------------------------------------------------------------- VII EYES IN THE CAPS: under, or over
s = new('m6', 'VII  EYES IN THE CAPS', 116, 66, 0.6, 1)
s.cave([(0, 44)], [(0, 16), (8, 30), (108, 16)])
s.hint(1, 26, 'THE   CAPS   HAVE   EYES  -  GO   UNDER   OR   OVER')
for k, cx in enumerate((26, 54, 82)):
    s.plat(cx - 6, 26, 12, 2)                 # a hanging cap
    s.vine(cx - 7, 21, 44)                    # a hypha down its edge
    s.watch(cx + 0.5, 28.5, 22, 15, 90, 40, 9, k * 3.0, I=2.0, burn=2.0)
for x in (38, 66, 94):
    s.shelf(x, 24, 5)
s.hint(40, 15, 'E   THE   SEEKER   CAN   COVER   AN   EYE', cmp=True)
s.tether(110, 44)

# ---------------------------------------------------------------- CAP BRIDGE: over the tar on the backs of caps
s = new('m8', 'CAP BRIDGE', 112, 70, 0.55, 4)
s.cave([(0, 40), (8, 64), (104, 40)], [(0, 16), (8, 40), (104, 16)])
s.kills.append((8 * 6, 56 * 6, 104 * 6, 66 * 6))
for k, (x, y) in enumerate([(11, 40), (21, 37), (31, 39), (41, 36), (51, 38), (61, 35), (71, 37), (81, 35), (91, 38)]):
    s.plat(x, y, 7, 2, way=True)
    s.rock(x + 3, y + 2, 1, 62 - y)
for k, x in enumerate((24.5, 44.5, 64.5, 84.5)):
    breathe(s, x, 27.5, 11, 6, 3, k * 1.5)
s.hint(1, 21, 'CROSS   ON   THE   BACKS   OF   THE   CAPS')
s.tether(108, 40)

# ---------------------------------------------------------------- ROOT TANGLE: down from strand to strand
s = new('m9', 'ROOT TANGLE', 96, 96, 0.55, 3)
s.floor[0] = 24
s.floor[95] = 80
s.air(0, 16, 10, 8)             # way in, high on the left
s.air(8, 10, 80, 72)            # the tangle
s.air(86, 72, 10, 8)            # way out, low on the right
s.rock(80, 80, 16, 2)
s.kills.append((8 * 6, 78 * 6, 80 * 6, 84 * 6))
for k, x in enumerate((14, 22, 30, 38, 46, 54, 62, 70, 77)):
    s.vine(x, 10 + k * 3, 40 + k * 4)
    if k < 8:
        s.plat(x - 1, 41 + k * 4, 3, 1, way=True)   # a root knot at the strand's end
for k, (x, y) in enumerate(((26, 34), (42, 46), (58, 58), (70, 66))):
    s.orb(x + 0.5, y, 7, 4, 7, 8, k * 0.25, 1.2)
s.hint(1, 13, 'DOWN   THROUGH   THE   TANGLE')
s.tether(90, 80)

# ---------------------------------------------------------------- SPORE CLOUD: weave up and down through the drift
s = new('m10', 'SPORE CLOUD', 120, 62, 0.6, 5)
s.cave([(0, 44)], [(0, 16), (8, 30), (112, 16)])
for y in (41, 38, 35, 32, 29):
    off = (y % 2) * 6
    for x0 in range(8 + off, 110, 14):
        s.shelf(x0, y, 9)
for k, (y, ph) in enumerate(((42.5, 0.0), (36.5, 0.33), (30.5, 0.66))):
    s.orbline(10, y, 96, 0, 5, 10, ph, 1.2)
s.hint(1, 13, 'THE   SPORES   DRIFT  -  SLIP   ABOVE   OR   BELOW')
s.tether(116, 44)

# ---------------------------------------------------------------- MYCELIAL WEB: up through the strands
s = new('m11', 'MYCELIAL WEB', 96, 96, 0.6, 2)
s.floor[0] = 44
s.floor[95] = 24
s.air(0, 36, 10, 8)             # way in, low on the left
s.air(8, 12, 80, 70)            # the web
s.air(86, 16, 10, 8)            # way out, high on the right
s.rock(82, 24, 14, 2)
s.rock(8, 44, 8, 2)
s.kills.append((16 * 6, 78 * 6, 88 * 6, 84 * 6))
for k, x in enumerate((18, 26, 34, 42, 50, 58, 66, 74)):
    s.vine(x, 44 - k * 3, 78)
    s.plat(x + 1, 46 - k * 3, 3, 1, way=True)        # a knot to rest on
for k, x in enumerate((30, 54, 70)):
    breathe(s, x + 0.5, 20.5 + k * 4, 10, 6, 3, k * 2.0)
s.hint(1, 33, 'UP   THROUGH   THE   WEB')
s.tether(90, 24)

# ---------------------------------------------------------------- GILL RUN: under the gills while the caps breathe
s = new('m12', 'GILL RUN', 150, 60, 0.65, 4)
s.cave([(0, 40)], [(0, 14), (8, 20), (142, 14)])
for x in (14, 36, 58, 80, 102, 124):
    s.rock(x, 33, 8, 2)          # a gill to shelter under
    s.rock(x + 3, 37, 1, 3)
for k, x in enumerate((25, 47, 69, 91, 113, 135)):
    breathe(s, x + 0.5, 28.5, 14, 6, 3, k * 1.0)
for x0 in (28, 72, 116):
    s.pit(x0, x0 + 4, depth=12)
s.hint(1, 18, 'KEEP   UNDER   THE   GILLS')
s.tether(146)

# ---------------------------------------------------------------- SPORE STAIR: up the shelves through the drift
s = new('m13', 'SPORE STAIR', 110, 70, 0.7, 2)
s.cave([(0, 44), (88, 20)], [(0, 16), (8, 36), (88, 10)])
for k in range(8):
    s.shelf(10 + 10 * k, 41 - 3 * k, 8, way=(k % 2 == 1))
for k in range(2):
    s.orbline(8, 37, 80, -21, 7, 8, k * 0.5, 1.2)
s.hint(1, 13, 'UP   THROUGH   THE   DRIFT')
s.tether(106, 20)

# ---------------------------------------------------------------- THE UNDERSTORY: caps throw you over the walls
s = new('m14', 'THE UNDERSTORY', 136, 60, 0.75, 1)
s.cave([(0, 44)], [(0, 16), (8, 22), (128, 16)])
for k, x in enumerate((30, 64, 98)):
    s.rock(x, 37, 3, 7)          # a fallen stem, too tall to jump
    s.air(x - 7, 44, 4, 2)
    s.bounce(x - 7, 46, 4)       # a cap in a hollow, to throw you over it
    s.way(x + 6, 44)
for k, x in enumerate((15, 47, 81, 115)):
    breathe(s, x + 0.5, 32.5, 12, 6, 3, k * 1.5)
s.hint(1, 20, 'THE   CAPS   THROW   YOU   OVER')
s.tether(132)

# ---------------------------------------------------------------- VIII MOTHER CAP: climb the great stalk
s = new('m7', 'VIII  MOTHER CAP', 96, 76, 1.0, 0)
s.cave([(0, 66), (40, 20)], [(0, 14), (14, 52), (40, 14)])
# the stalk: two strands up its face, a rest ledge between
s.vine(30, 38, 66)
s.plat(31, 42, 6, 2, way=True)
s.vine(38, 16, 42)
s.watch(56.5, 10.5, 34, 12, 90, 0, 12, 0.0, I=2.0, spin=True, burn=2.0)
for x in (42, 60):
    s.rock(x, 15, 6, 2)
cap(s, 50.5, 20, 9, 4, 2, 0)
s.rock(74, 18, 10, 2)
s.rock(77, 16, 4, 2)
s.lamp(79.0, 11.5, 26, 1.0, col='shard', haz=False)
s.goal_at(79.0, 13.0)

META = dict(idx=1, name='THE MYCELIUM', theme='mycelium')

if __name__ == '__main__':
    build_level(secs, META)
