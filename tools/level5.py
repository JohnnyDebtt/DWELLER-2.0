"""DWELLER — Level V: EMBER DEEP. Crimson caves above a buried sun. Its light fills whole halls,
so the only safety is the shadow a stone throws. Embers rise from the tar."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, build_level

secs = []


def new(name, title, w, hs, e, root):
    s = Sec(name, title, w, hs, dict(e=e, root=root))
    secs.append(s)
    return s


def ember(s, x, y0, rise, r, per, ph, I=1.2):
    """an ember that rises and sinks on a line"""
    s.orbline(x, y0, 0, -rise, r, per, ph, I)


def sun(s, x, y, r, I=1.2, burn=1.0):
    s.lamp(x, y, r, I)
    s.lights[-1]['burnMul'] = burn


# ---------------------------------------------------------------- I CINDER GATE
s = new('e0', 'I  CINDER GATE', 100, 56, 0.2, 0)
s.cave([(0, 40)], [(0, 14), (16, 17), (88, 14)])
s.spawn_at(6)
s.hint(20, 19, 'HIDE   IN   THE   SHADOW   OF   STONE')
ember(s, 40.5, 38, 12, 9, 6, 0.0)
ember(s, 64.5, 38, 12, 9, 6, 0.5)
s.rock(51, 37, 3, 3)

# ---------------------------------------------------------------- II THE SUN BELOW
s = new('e1', 'II  THE BURIED SUN', 140, 70, 0.35, 4)
s.cave([(0, 40), (12, 44), (128, 40)], [(0, 14), (12, 32), (128, 14)])
sun(s, 70.5, 16.5, 42, 1.25)
for x in (36, 50, 64, 78, 92):
    s.plat(x, 40, 7, 1)
s.rock(106, 41, 3, 3)
s.rock(26, 41, 3, 3)
s.rock(125, 42, 3, 2)          # a step back up
ember(s, 57.5, 42, 10, 7, 5, 0.0)
ember(s, 85.5, 42, 10, 7, 5, 0.5)
for wx in (39, 53, 67, 81, 95):
    s.way(wx + 0.5, 44)
s.tether(132)

def blank(s, entry, exit_):
    s.floor[0] = entry
    s.floor[s.w - 1] = exit_


# ---------------------------------------------------------------- III ASH VENTS: ride the hot air up past the sun
s = new('e2', 'III  ASH VENTS', 60, 104, 0.5, 2)
blank(s, 86, 18)
s.air(0, 78, 8, 8)              # way in
s.air(6, 10, 48, 88)            # the shaft
s.air(48, 10, 12, 8)            # way out, high on the right
sun(s, 30.5, 95.5, 72, 1.2)
s.kills.append((6 * 6, 92 * 6, 54 * 6, 99 * 6))
ledges = [(86, 'L'), (72, 'R'), (58, 'L'), (44, 'R'), (30, 'L'), (18, 'R')]
for k, (y, side) in enumerate(ledges):
    if side == 'L':
        s.rock(6, y, 19, 2)
    else:
        s.rock(35, y, 25 if k == len(ledges) - 1 else 19, 2)
for k in range(len(ledges) - 1):
    y0, side = ledges[k]
    y1 = ledges[k + 1][0]
    x = 25 if side == 'L' else 31
    s.vent(x, y1 - 4, y0, 4)
    s.way(16 if side == 'L' else 44, y0)
s.hint(1, 75, 'THE   SUN   IS   BELOW  -  RIDE   THE   ASH')
s.tether(56, 18)

# ---------------------------------------------------------------- IV THE CRUST: stepping stones over the tar
s = new('e3', 'IV  THE CRUST', 132, 72, 0.5, 5)
s.cave([(0, 40), (8, 64), (124, 40)], [(0, 18), (8, 44), (124, 18)])
s.kills.append((8 * 6, 56 * 6, 124 * 6, 66 * 6))
stones = [(10, 40, 3), (16, 38, 2), (21, 39, 2), (26, 36, 2), (31, 38, 2), (36, 35, 3)]
for (x, y, w) in stones:
    s.rock(x, y, w, 64 - y)
    s.way(x + w / 2.0, y)
s.bounce(46, 46, 3, 1)          # a geyser stone, low in the tar
s.rock(46, 47, 3, 17)
for (x, y, w) in [(55, 36, 3), (61, 38, 2), (66, 35, 2), (71, 37, 2), (76, 34, 3)]:
    s.rock(x, y, w, 64 - y)
    s.way(x + w / 2.0, y)
s.bounce(86, 46, 3, 1)
s.rock(86, 47, 3, 17)
for (x, y, w) in [(95, 36, 3), (101, 37, 2), (106, 39, 2), (111, 38, 2), (116, 40, 8)]:
    s.rock(x, y, w, 64 - y)
    s.way(x + w / 2.0, y)
for k, x in enumerate((19, 29, 49, 64, 88, 104)):
    ember(s, x + 0.5, 54, 26, 8, 6, k * 0.17)
s.hint(1, 16, 'THE   GEYSER   STONES   THROW   YOU   FAR')
s.tether(128)

# ---------------------------------------------------------------- V THE BELL: three suns, three stones
s = new('e4', 'V  THE BELL', 128, 64, 0.55, 3)
s.cave([(0, 44)], [(0, 16), (8, 30), (120, 16)])
s.hint(2, 24, 'EACH   STONE   SLEEPS   ONE   SUN')
for k, (sx, hx, beats) in enumerate(((34.5, 14, 5), (66.5, 46, 5.5), (98.5, 80, 6))):
    sun(s, sx, 30.5, 24, 1.25)
    q = s.hush(hx, 44 if k != 1 else 41, beats)
    s.link(q)
s.rock(42, 41, 8, 3)            # the second stone waits on a plinth
s.rock(74, 42, 12, 1)           # the third under a low lintel
s.way(46, 41)
s.way(80, 44)
s.tether(122, 44)

# ---------------------------------------------------------------- VI THE CHAINS: climb between the rising embers
s = new('e5', 'VI  THE CHAINS', 60, 108, 0.6, 1)
blank(s, 96, 16)
s.air(0, 88, 10, 8)             # way in
s.air(8, 8, 44, 88)             # the hall of chains
s.air(48, 8, 12, 8)             # way out
s.kills.append((10 * 6, 96 * 6, 50 * 6, 104 * 6))
s.rock(8, 96, 6, 2)
s.rock(46, 16, 14, 2)
for x in (16, 25, 34, 43):
    s.vine(x, 18, 96)
for k, x in enumerate((20, 29, 38)):
    s.orbline(x + 0.5, 30, 0, 56, 8, 8, k * 0.33, 1.2)
s.hint(1, 85, 'HOLD   UP   TO   CLIMB')
s.tether(56, 16)

# ---------------------------------------------------------------- VII SUNSET: the sun walks the tunnel
s = new('e6', 'VII  SUNSET', 150, 60, 0.75, 4)
s.cave([(0, 40)], [(0, 14), (8, 20), (142, 14)])
s.hint(2, 18, 'KEEP   BEHIND   THE   WALKING   SUN')
s.orbline(8, 26, 128, 0, 22, 32, 0.0, 1.3)
s.lights[-1]['burnMul'] = 1.25
for x in (20, 44, 68, 116):
    s.rock(x, 33, 7, 2)          # awnings to shelter under
    s.rock(x, 37, 1, 3)
s.pit(56, 61, depth=14)
s.pit(104, 109, depth=14)
s.rock(82, 34, 12, 3)            # a low tunnel
s.tether(144)

# ---------------------------------------------------------------- OBSIDIAN STAIR: up the slick black treads
s = new('e8', 'OBSIDIAN STAIR', 110, 80, 0.85, 2)
steps = [(0, 60), (12, 57), (24, 54), (36, 51), (48, 48), (60, 45), (72, 42), (84, 39), (96, 36)]
s.cave(steps, [(x, y - 16) for x, y in steps])
for k, (x, y) in enumerate(steps):
    s.ice(x, y, 12)
    if k % 2 == 1:
        ember(s, x + 6.5, y - 1, 12, 6, 6, k * 0.12)
s.hint(1, 42, 'THE   OBSIDIAN   IS   SLICK')
s.tether(104)

# ---------------------------------------------------------------- THE TURNING SUN: walls against the wheel
s = new('e9', 'THE TURNING SUN', 104, 60, 0.9, 4)
s.cave([(0, 40)], [(0, 14), (8, 28), (96, 14)])
s.watch(52.5, 21.5, 44, 10, 90, 0, 16, 0.0, I=2.0, spin=True, burn=2.0)
s.rock(48, 22, 9, 3)            # the sun's hub
for x in (18, 30, 42, 62, 74, 86):
    s.rock(x, 36, 2, 4)          # low walls to crouch behind
s.hint(1, 20, 'THE   SUN   TURNS  -  KEEP   A   WALL   BETWEEN')
s.tether(98)

# ---------------------------------------------------------------- MAGMA LOCKS: a stone, a geyser, a wall
s = new('e10', 'MAGMA LOCKS', 120, 64, 0.95, 5)
s.cave([(0, 44)], [(0, 16), (8, 24), (112, 16)])
for k in range(3):
    x0 = 6 + 36 * k
    sun(s, x0 + 18.5, 28.5, 22, 1.25)
    q = s.hush(x0 + 4, 44, 8)
    s.link(q)
    s.pit(x0 + 11, x0 + 15, depth=14)
    s.air(x0 + 22, 44, 4, 2)    # the geyser sits in a vent in the floor
    s.bounce(x0 + 22, 46, 4)
    s.rock(x0 + 30, 37, 4, 7)
    s.way(x0 + 4, 44)
    s.way(x0 + 35.5, 44)        # in the wall's shadow
s.hint(1, 22, 'EACH   LOCK   HAS   ITS   STONE')
s.tether(116, 44)

# ---------------------------------------------------------------- ASH FALLS: embers fall; wait under the shelves
s = new('e11', 'ASH FALLS', 140, 60, 0.95, 3)
s.cave([(0, 40)], [(0, 14), (8, 18), (132, 14)])
for k, x in enumerate(range(16, 130, 12)):
    s.orbline(x + 0.5, 23, 0, 16, 6, 6, k * 0.37, 1.2)
    s.rock(x + 5, 33, 4, 2)      # a shelf of stone to wait under
s.hint(1, 18, 'THE   ASH   FALLS')
s.tether(136)

# ---------------------------------------------------------------- MAGMA RIVER: stones in the flow, the sun walks
s = new('e12', 'MAGMA RIVER', 150, 72, 1.0, 5)
s.cave([(0, 40), (8, 64), (142, 40)], [(0, 14), (8, 48), (142, 14)])
s.kills.append((8 * 6, 56 * 6, 142 * 6, 66 * 6))
for k, x in enumerate(range(10, 138, 9)):
    y = 40 - (k % 3)
    if k % 3 == 0:
        s.rock(x, y, 6, 64 - y)
        s.rock(x - 1, y - 7, 8, 2)   # a roof of slag
        s.way(x + 3, y)
    else:
        s.rock(x, y, 4, 64 - y)
s.orbline(8, 24, 130, 0, 18, 24, 0.0, 1.3)
s.lights[-1]['burnMul'] = 1.25
s.hint(1, 16, 'WAIT   UNDER   THE   SLAG   FOR   THE   SUN   TO   PASS')
s.tether(146)

# ---------------------------------------------------------------- SLAG HEAPS: back and forth, down the heaps
s = new('e13', 'SLAG HEAPS', 90, 90, 1.0, 2)
blank(s, 20, 80)
s.air(0, 12, 8, 8)              # way in
s.air(6, 8, 78, 74)             # the heaps
s.air(82, 72, 8, 8)             # way out
for (y, x0, x1) in ((20, 6, 30), (32, 26, 76), (44, 10, 82), (56, 6, 70), (68, 14, 84), (80, 6, 90)):
    s.rock(x0, y, x1 - x0, 2)
for k, (x, y) in enumerate(((50, 32), (40, 44), (36, 56), (50, 68))):
    s.lamp(x + 0.5, y - 5.5, 8, 1.2, sched=dict(per=4 * 64, len=2 * 64, ph=k * 64, warn=32))
    s.lights[-1]['burnMul'] = 1.5
s.hint(1, 9, 'DOWN   THE   HEAPS')
for wx, wy in ((72, 32), (79, 44), (12, 44), (8, 56), (66, 56), (78, 68), (16, 68), (8, 80)):
    s.way(wx, wy)
s.tether(86, 80)

# ---------------------------------------------------------------- THE KILN: crawl through the pillars' feet
s = new('e14', 'THE KILN', 130, 60, 1.0, 4)
s.cave([(0, 42)], [(0, 14), (8, 30), (122, 14)])
for x in (30.5, 70.5, 110.5):
    sun(s, x, 20.5, 30, 1.2)
for x in (22, 38, 62, 78, 102, 118):
    s.rock(x, 30, 3, 11)         # a pillar; its foot leaves a crawl
s.hint(1, 18, 'CRAWL   IN   THE   SHADOW   OF   THE   PILLARS')
s.tether(126)

# ---------------------------------------------------------------- VIII HEART OF EMBER: up the shaded wall, over the sun
s = new('e7', 'VIII  HEART OF EMBER', 100, 96, 1.0, 0)
blank(s, 86, 20)
s.air(0, 78, 8, 8)              # way in
s.air(6, 10, 88, 78)            # the dome
sun(s, 56.5, 58.5, 64, 1.25, burn=1.25)
s.rock(6, 86, 20, 2)
s.kills.append((26 * 6, 84 * 6, 94 * 6, 90 * 6))
s.rock(24, 24, 2, 62)           # the wall between the climb and the sun
for (y0, y1) in ((66, 70), (50, 54), (34, 38)):
    s.air(24, y0, 2, y1 - y0)   # windows the light comes through
for k, y in enumerate(range(83, 21, -3)):
    s.shelf(15 if k % 2 == 0 else 7, y, 8)
s.rock(26, 22, 50, 2)           # the bridge over the sun: it shades itself
for k, x in enumerate((38, 60)):
    s.orbline(x, 15, 14, 0, 7, 6, k * 0.5, 1.2)
s.rock(76, 22, 18, 2)
s.rock(84, 20, 4, 2)
s.lamp(86.0, 13.5, 26, 1.0, col='shard', haz=False)
s.goal_at(86.0, 17.0)
s.hint(1, 75, 'THE   WALL   KEEPS   THE   SUN   OFF  -  MOSTLY')

META = dict(idx=4, name='EMBER DEEP', theme='ember')

if __name__ == '__main__':
    build_level(secs, META)
