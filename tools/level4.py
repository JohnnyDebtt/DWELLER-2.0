"""DWELLER — Level IV: THE FOUNDRY. A rusted machine-deep that keeps its own time. Here the way
goes up as much as along: hot air from the vents carries you, grates let you through from below,
pistons of light slam on the beat, and some of the machinery has levers: hush stones."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, build_level

secs = []


def new(name, title, w, hs, e, root):
    s = Sec(name, title, w, hs, dict(e=e, root=root))
    secs.append(s)
    return s


def furnace(s, x, y, r, per, on, ph, I=1.2, burn=1.5, warn=0.5):
    s.lamp(x, y, r, I, sched=dict(per=int(per * 64), len=int(on * 64), ph=int(ph * 64), warn=int(warn * 64)))
    s.lights[-1]['burnMul'] = burn


def pendulum(s, xc, y, swing, r, per, ph, I=1.3):
    s.orbline(xc - swing / 2.0, y, swing, 0, r, per, ph, I)


def blank(s, entry, exit_):
    s.floor[0] = entry
    s.floor[s.w - 1] = exit_


# ---------------------------------------------------------------- I FURNACE DOOR: the first vent
s = new('f0', 'I  FURNACE DOOR', 84, 56, 0.2, 0)
s.cave([(0, 42), (60, 24)], [(0, 14), (16, 30), (60, 12)])
s.spawn_at(5)
s.hint(2, 24, 'THE   FOUNDRY   KEEPS   TIME')
furnace(s, 26.5, 34.5, 10, 4, 2, 0)
furnace(s, 42.5, 34.5, 10, 4, 2, 2)
s.vent(53, 14, 42, 6)
s.hint(40, 10, 'RIDE   THE   HOT   AIR')
s.way(63, 24)
s.tether(78)

# ---------------------------------------------------------------- II PISTONS: over a broken floor
s = new('f1', 'II  PISTONS', 120, 56, 0.35, 4)
s.cave([(0, 40)], [(0, 15)])
s.hint(4, 20, 'THE   PISTONS   FALL   ON   THE   BEAT')
for k, x0 in enumerate((14, 30, 46, 62, 78, 94)):
    s.beam(x0 + 4.0, 22.5, 8, 22, per=8, on=4, ph=float(k) * 1.5, warn=0.75, burn=4.0)
for x0 in (22, 38, 54, 70, 86):
    s.pit(x0 + 1, x0 + 7, depth=12)
    s.plat(x0 + 1, 38, 6, 1)
for wx in (26, 42, 58, 74, 90):
    s.way(wx, 38)
s.tether(112)

# ---------------------------------------------------------------- III THE STACK: three vents up a chimney
s = new('f2', 'III  THE STACK', 40, 104, 0.4, 2)
blank(s, 94, 20)
s.air(0, 86, 8, 8)          # way in
s.air(6, 10, 22, 84)        # the stack
s.air(28, 12, 12, 8)        # way out
s.vent(7, 66, 94, 6)
s.shelf(15, 68, 11, way=True)
s.vent(19, 44, 68, 6)
s.shelf(6, 46, 11, way=True)
s.vent(7, 18, 46, 6)
s.shelf(14, 20, 14, way=True)
for k, (x, y) in enumerate(((22, 82), (12, 58), (22, 34))):
    furnace(s, x + 0.5, y + 0.5, 11, 4, 2, k * 1.33, I=1.2, burn=1.5)
s.hint(1, 83, 'UP   THE   STACK')
s.tether(34, 20)

# ---------------------------------------------------------------- IV GANTRY: two rows of grates
s = new('f3', 'IV  GANTRY', 124, 70, 0.45, 5)
s.cave([(0, 34), (8, 62), (116, 34)], [(0, 16), (8, 48), (116, 16)])
s.kills.append((8 * 6, 47 * 6, 116 * 6, 64 * 6))
s.hint(1, 14, 'DOWN   TO   DROP   THROUGH   A   GRATE')
for x in range(8, 116, 12):
    s.shelf(x, 33, 9, way=True)
    s.shelf(x + 4, 36, 9, way=True)
for k, xc in enumerate((24, 48, 72, 96)):
    pendulum(s, xc, 26, 22, 8, 6, k * 0.25, I=1.3)
for k, x in enumerate((36, 84)):
    furnace(s, x + 0.5, 40.5, 7, 4, 2, k * 2)
s.tether(120)

# ---------------------------------------------------------------- V THE BOILERS: up to the lever, then race the fire
s = new('f4', 'V  THE BOILERS', 104, 60, 0.45, 5)
s.cave([(0, 40)], [(0, 14), (8, 26), (96, 14)])
s.hint(2, 24, 'THE   LEVER   IS   UP   THE   FLUE')
for x in (40.5, 56.5, 72.5):
    furnace(s, x, 36.5, 12, 4, 4, 0, I=1.2, burn=1.5, warn=0.0)
    s.lights[-1].pop('sched')
s.vent(12, 16, 40, 5)
s.shelf(17, 22, 20, way=True)
k = s.hush(33, 22, 12)
s.link(k, 3)
s.way(33, 22)
s.hint(40, 12, 'NOW   RUN')
s.tether(98)

# ---------------------------------------------------------------- VI THE LOCK: levers for the pistons
s = new('f5', 'VI  THE LOCK', 116, 64, 0.5, 3)
s.cave([(0, 46)], [(0, 18), (8, 26), (108, 18)])
s.hint(2, 26, 'THE   LOCK   HAS   LEVERS')
k = s.hush(10, 46, 3)
s.beam(24.5, 20.5, 6, 26, steady=True, burn=4.0)
s.link(k)
# the second lever is up a vent, and opens the next two pistons
s.vent(34, 22, 46, 5)
s.plat(40, 28, 8, 2)
k2 = s.hush(45, 28, 4)
for bx in (56, 64):
    s.beam(bx + 0.5, 20.5, 6, 26, steady=True, burn=4.0)
    s.link(k2)
s.way(45, 28)
# the last piston keeps its own time; the third lever is beneath a grate
s.shelf(76, 40, 8)
k3 = s.hush(80, 46, 3)
s.beam(92.5, 20.5, 6, 26, steady=True, burn=4.0)
s.link(k3)
s.beam(100.5, 20.5, 5, 26, per=6, on=3, ph=0.0, burn=4.0)
s.way(80, 46)
s.tether(110)

# ---------------------------------------------------------------- VII FURNACE STAIRS: down, between the shots
s = new('f6', 'VII  FURNACE STAIRS', 100, 90, 0.6, 2)
steps = [(0, 20), (14, 28), (28, 36), (42, 44), (56, 52), (70, 60), (84, 68)]
s.cave(steps, [(x, 12) for x, _ in steps])
for k, (x, y) in enumerate(steps[1:]):
    # each tread is raked by a shot from the riser of the stair above it
    s.air(x - 3, y - 3, 3, 3)
    s.beam(x - 1.5, y - 1.0, 2.5, 13, per=6, on=2, ph=k * 1.0, ang=0, chimney=False, burn=2.0)
for x, y in steps:
    s.way(x + 3, y)
s.tether(94)

# ---------------------------------------------------------------- VIII ASSEMBLY LINE: vents over the gaps
s = new('f7', 'VIII  ASSEMBLY LINE', 150, 64, 0.85, 4)
s.cave([(0, 40)], [(0, 15)])
s.hint(6, 20, 'FASTER   NOW')
for k in range(14):
    x0 = 14 + 9 * k
    s.beam(x0 + 2.5, 22.5, 5, 22, per=6, on=3, ph=-float(k) * 0.75, burn=4.0)
for x0 in (34, 70, 106):
    s.pit(x0, x0 + 10, depth=14)
    s.vent(x0 + 3, 26, 52, 4)
    s.way(x0 - 2, 40)
s.tether(144)

# ---------------------------------------------------------------- THE FORGE: hammers fall fast, anvils between
s = new('f9', 'THE FORGE', 120, 60, 0.9, 4)
s.cave([(0, 40)], [(0, 15)])
for k in range(6):
    x0 = 16 + 15 * k
    s.beam(x0 + 2.5, 22.5, 5, 22, per=4, on=1.5, ph=k * 0.67, warn=0.75, burn=4.0)
    s.rock(x0 + 7, 38, 3, 2)
s.hint(2, 20, 'THE   HAMMERS   ARE   QUICKER')
s.tether(114)

# ---------------------------------------------------------------- SCRAPYARD: over the heaps under swinging lamps
s = new('f10', 'SCRAPYARD', 130, 64, 0.9, 2)
s.cave([(0, 44)], [(0, 16), (8, 20), (122, 16)])
for (x, y, w) in [(10, 41, 5), (15, 39, 4), (19, 37, 5), (24, 40, 4), (28, 42, 4), (36, 41, 4), (40, 38, 5), (45, 36, 6), (51, 39, 4), (55, 41, 5), (64, 41, 4), (68, 38, 4), (72, 35, 6), (78, 38, 4), (82, 41, 4), (90, 40, 5), (95, 37, 5), (100, 39, 4), (104, 41, 5)]:
    s.rock(x, y, w, 44 - y)
for k, xc in enumerate((26, 52, 80, 106)):
    pendulum(s, xc, 26, 20, 9, 6, k * 0.25, I=1.3)
s.hint(2, 18, 'MIND   THE   SWINGING   LAMPS')
s.tether(126, 44)

# ---------------------------------------------------------------- PIPEWORKS: down a pipe, along, up the riser
s = new('f11', 'PIPEWORKS', 90, 84, 0.95, 5)
blank(s, 30, 30)
s.air(0, 22, 14, 8)             # the way in
s.air(10, 22, 4, 50)            # the down pipe
s.vine(12, 24, 70)
s.air(10, 64, 70, 8)            # the long pipe, floor 72
s.air(76, 14, 4, 58)            # the riser
s.vent(76, 24, 72, 4)
s.air(80, 22, 10, 8)            # out, floor 30
for k, x in enumerate((26, 42, 58)):
    s.air(x + 5, 59, 3, 5)      # a vent hood to duck into
    furnace(s, x + 0.5, 68.5, 8, 4, 2, k * 1.33, I=1.2, burn=1.5)
s.hint(1, 19, 'DOWN   THE   PIPE')
s.way(16, 72)
s.way(70, 72)
s.tether(86, 30)

# ---------------------------------------------------------------- THE SMELTER: sprung plates over the tar
s = new('f12', 'THE SMELTER', 112, 72, 0.95, 3)
s.cave([(0, 40), (8, 64), (104, 40)], [(0, 16), (8, 48), (104, 16)])
s.kills.append((8 * 6, 56 * 6, 104 * 6, 66 * 6))
for k, x in enumerate(range(13, 98, 14)):
    y = 48 if k % 2 == 0 else 47
    s.bounce(x, y, 5)
    s.rock(x, y + 1, 5, 63 - y)
    if x + 12 < 104:
        s.rock(x + 9, 43, 3, 21)    # a cold post between the plates
        s.way(x + 10.5, 43)
for k, x in enumerate((25, 47, 69, 91)):
    furnace(s, x + 0.5, 32.5, 9, 4, 2, k * 1.0, I=1.2, burn=1.5)
s.hint(1, 14, 'THE   PLATES   ARE   SPRUNG')
s.tether(108)

# ---------------------------------------------------------------- CONVEYOR: oiled floor, levers for the pistons
s = new('f13', 'CONVEYOR', 150, 60, 0.95, 4)
s.cave([(0, 40)], [(0, 15)])
s.ice(8, 40, 134)
for k, hx in enumerate((12, 54, 96)):
    q = s.hush(hx, 40, 6)
    for bx in (hx + 14, hx + 24):
        s.beam(bx + 0.5, 22.5, 5, 22, steady=True, burn=4.0)
        s.link(q)
    s.way(hx, 40)
s.hint(2, 20, 'THE   FLOOR   IS   OILED')
s.tether(146)

# ---------------------------------------------------------------- CRANE YARD: platforms under the swinging lamps
s = new('f14', 'CRANE YARD', 130, 64, 1.0, 2)
s.cave([(0, 40), (8, 62), (122, 40)], [(0, 15), (8, 46), (122, 15)])
s.kills.append((8 * 6, 54 * 6, 122 * 6, 64 * 6))
for k, x in enumerate(range(8, 118, 13)):
    s.plat(x, 40, 8, 2)
    if k % 2 == 1:
        pendulum(s, x + 4, 31, 16, 10, 6, k * 0.25, I=1.3)
s.hint(2, 22, 'THE   CRANES   SWING')
s.tether(126)

# ---------------------------------------------------------------- IX THE BELLOWS: three breaths to the top
s = new('f8', 'IX  THE BELLOWS', 84, 100, 1.0, 0)
blank(s, 90, 20)
s.air(0, 82, 10, 8)             # way in, at the bottom
s.air(8, 12, 68, 78)            # the bellows
s.kills.append((18 * 6, 89 * 6, 76 * 6, 93 * 6))
s.rock(8, 90, 10, 2)            # where you come in
s.rock(8, 88, 10, 2)
s.air(8, 82, 10, 6)
s.vent(18, 62, 90, 6)
s.plat(25, 62, 9, 2, way=True)
s.vent(36, 40, 62, 6)
s.plat(43, 40, 9, 2, way=True)
s.vent(54, 18, 40, 6)
s.plat(61, 20, 15, 2)
for k, (xc, y) in enumerate(((21, 76), (39, 52), (57, 30))):
    pendulum(s, xc, y, 16, 8, 6, k * 0.33, I=1.3)
for k, x in enumerate((28, 46)):
    furnace(s, x + 0.5, y + 0.5 if False else (58.5 if k == 0 else 36.5), 9, 4, 2, k * 2)
s.watch(66.5, 13.5, 26, 12, 90, 0, 10, 0.0, I=2.0, spin=True, burn=2.5)
s.rock(70, 18, 6, 2)
s.rock(71, 16, 4, 2)
s.lamp(73.0, 12.5, 24, 1.0, col='shard', haz=False)
s.goal_at(73.0, 13.0)
s.hint(1, 79, 'THREE   BREATHS   TO   THE   TOP')

META = dict(idx=3, name='THE FOUNDRY', theme='foundry')

if __name__ == '__main__':
    build_level(secs, META)
