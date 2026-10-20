"""DWELLER — Level III: THE GLASS GARDEN. Violet crystal caves. The way doubles back on itself:
right, down, left, down, right. Floors of slick glass, prism pads that throw you upward, steady
prisms that only a hush stone can quiet, and threads of glass to slide down a chasm."""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, build_level

secs = []


def new(name, title, w, hs, e, root):
    s = Sec(name, title, w, hs, dict(e=e, root=root))
    secs.append(s)
    return s


def prism(s, x, ceil, ang, per, on, ph, w=4, floor=40, burn=4.0, warn=0.75, steady=False):
    """an angled beam cut into the ceiling, reaching the floor"""
    y = ceil - 0.6
    ln = (floor - y) / math.sin(math.radians(ang)) + 2
    s.beam(x, y, w, ln, per=per, on=on, ph=ph, ang=ang, chimney='notch', burn=burn, warn=warn, steady=steady)


def blank(s, entry, exit_):
    """a section carved by hand from solid rock: only the entry and exit floors are declared"""
    s.floor[0] = entry
    s.floor[s.w - 1] = exit_


# ---------------------------------------------------------------- I LENS GATE: the first hush stone
s = new('g0', 'I  LENS GATE', 92, 56, 0.2, 0)
s.cave([(0, 40)], [(0, 14), (16, 15), (80, 14)])
s.spawn_at(5)
s.hint(2, 20, 'STAND   ON   THE   STONE   TO   HUSH   THE   LIGHT')
k = s.hush(22, 40, 5.5)
for x, a in ((36, 60), (48, 120), (60, 60)):
    prism(s, x, 25, a, 8, 3, 0, steady=True)
    s.link(k)
s.ice(30, 40, 36)
s.hint(52, 21, 'GLASS   IS   SLICK', cmp=None)
s.tether(84)

# ---------------------------------------------------------------- II THE SWITCHBACK: right, down, left, down, right
s = new('g1', 'II  THE SWITCHBACK', 72, 84, 0.3, 4)
blank(s, 24, 64)
s.air(0, 14, 64, 10)        # upper gallery, heading right
s.air(62, 24, 7, 20)        # first drop
s.air(2, 34, 67, 10)        # middle gallery, heading back left
s.air(2, 44, 7, 20)         # second drop
s.air(2, 54, 70, 10)        # lower gallery, heading right
for x in (14, 36):
    s.rock(x, 22, 3, 2)
prism(s, 26, 14, 60, 8, 3, 0, floor=24, w=3)
prism(s, 46, 14, 120, 8, 3, 4, floor=24, w=3)
s.ice(10, 44, 52)
for k2, x in enumerate((50, 26)):
    s.orb(x + 0.5, 38.5, 7, 5, 3, 6, k2 * 0.5, 1.2)
k = s.hush(12, 64, 6.5)
for x, a in ((32, 60), (50, 120)):
    prism(s, x, 54, a, 8, 3, 0, floor=64, w=3, steady=True)
    s.link(k)
for wx, wy in ((58, 24), (65, 44), (12, 44), (5, 64), (20, 64)):
    s.way(wx, wy)
s.tether(66, 64)

# ---------------------------------------------------------------- III PRISM PADS: bounce up a crystal well
s = new('g2', 'III  PRISM WELL', 38, 100, 0.45, 3)
blank(s, 90, 18)
s.air(0, 82, 8, 8)          # way in
s.air(6, 10, 22, 80)        # the well
s.air(28, 10, 10, 8)        # way out, high on the right
for k2, y in enumerate(range(90, 25, -8)):
    s.bounce(17 if k2 % 2 == 0 else 8, y, 5, 2)
s.rock(28, 18, 10, 2)
s.air(24, 10, 4, 8)
for k2, y in enumerate((76, 58, 40)):
    s.air(2, y - 1, 4, 3)
    s.beam(3.5, y + 0.5, 3, 26, per=8, on=3, ph=k2 * 2.67, ang=0, chimney=False, burn=1.5)
s.hint(1, 79, 'KEEP   JUMP   HELD')
s.tether(33, 18)

# ---------------------------------------------------------------- IV HUSH GARDEN: three stones, six lights
s = new('g3', 'IV  HUSH GARDEN', 112, 56, 0.45, 5)
s.cave([(0, 40)], [(0, 15), (8, 18), (104, 15)])
s.hint(4, 21, 'FIND   THE   STONE   THAT   HUSHES   EACH   PAIR')
# pair one: the stone is on the way
k = s.hush(12, 40, 3.5)
for bx in (22, 30):
    s.beam(bx + 0.5, 22.5, 5, 22, steady=True, burn=4.0)
    s.link(k)
# pair two: the stone waits on a ledge a pad can reach
s.bounce(38, 40, 4)
s.plat(42, 33, 7, 2)
k = s.hush(46, 33, 4)
for bx in (58, 66):
    s.beam(bx + 0.5, 22.5, 5, 22, steady=True, burn=4.0)
    s.link(k)
s.ice(50, 40, 6)
s.way(46, 33)
# pair three: the stone sits atop three glass shelves
for k2, (x, y) in enumerate(((76, 37), (80, 34), (84, 31))):
    s.shelf(x, y, 4)
k = s.hush(85.5, 31, 3.5)
for bx in (94, 102):
    s.beam(bx + 0.5, 22.5, 5, 22, steady=True, burn=4.0)
    s.link(k)
s.way(85.5, 31)
s.orbline(76, 26, 10, 0, 7, 6, 0.0, 1.1)
s.tether(108)

# ---------------------------------------------------------------- V GLASS STAIR: up over the tar
s = new('g4', 'V  GLASS STAIR', 120, 80, 0.5, 1)
s.cave([(0, 56), (8, 70), (112, 26)], [(0, 14), (8, 58), (112, 14)])
s.kills.append((8 * 6, 59 * 6, 112 * 6, 72 * 6))
for k2 in range(15):
    s.shelf(9 + 7 * k2, 54 - 2 * k2, 5, way=True)
for k2, (ox, oy) in enumerate([(22, 44), (44, 38), (66, 32), (88, 26)]):
    s.orb(ox + 0.5, oy, 8, 6, 6, 8, (0.0 if k2 % 2 == 0 else 0.5), 1.3)
s.tether(116)

# ---------------------------------------------------------------- VI TWIN EYES: watched, on glass
s = new('g5', 'VI  TWIN EYES', 150, 60, 0.6, 1)
s.cave([(0, 40)], [(0, 14), (18, 22), (136, 22), (144, 14)])
for x in [10, 26, 42, 58, 74, 90, 106, 122]:
    s.rock(x, 33, 6, 2)
s.ice(16, 40, 104)
for k2, x in enumerate((36.5, 78.5, 120.5)):
    s.watch(x - 7, 18.5, 34, 13, 90, 50, 9, k2 * 3.0, I=2.0, burn=2.5)
    s.watch(x + 7, 18.5, 34, 13, 90, 50, 9, k2 * 3.0 + 4.5, I=2.0, burn=2.5)
s.hint(1, 21, 'THE   EYES   COME   IN   PAIRS')
s.hint(60, 21, 'E   THE   SEEKER   CAN   BLIND   AN   EYE', cmp=True)

# ---------------------------------------------------------------- VII CRYSTAL CHASM: slide down the threads
s = new('g6', 'VII  CRYSTAL CHASM', 40, 110, 0.6, 2)
blank(s, 20, 100)
s.air(0, 12, 8, 8)          # way in, high on the left
s.air(8, 12, 22, 88)        # the chasm
s.air(30, 92, 10, 8)        # way out, low on the right
s.vine(9, 16, 96)
s.vine(28, 16, 96)
for k2, y in enumerate((30, 44, 58, 72, 86)):
    side = k2 % 2
    s.air(4 if side == 0 else 30, y - 1, 4, 3)
    if side == 0:
        s.beam(5.5, y + 0.5, 3, 24, per=8, on=3, ph=k2 * 1.6, ang=0, chimney=False, burn=1.5)
    else:
        s.beam(32.5, y + 0.5, 3, 24, per=8, on=3, ph=k2 * 1.6, ang=180, chimney=False, burn=1.5)
for k2, y in enumerate((38, 66)):
    s.plat(14, y, 10, 1, way=True)
s.kills.append((10 * 6, 96 * 6, 28 * 6, 101 * 6))     # tar at the bottom: ride a thread down
s.hint(1, 9, 'DOWN   TO   SLIDE')
s.way(35, 100)
s.tether(36, 100)

# ---------------------------------------------------------------- VIII THE ORRERY: round the turning garden
s = new('g7', 'VIII  THE ORRERY', 92, 72, 0.8, 4)
blank(s, 52, 40)
for y in range(8, 62):
    for x in range(4, 86):
        if ((x - 44) / 40.0) ** 2 + ((y - 36) / 27.0) ** 2 <= 1.0:
            s.g[y, x] = 0
s.air(0, 44, 12, 8)             # way in, low on the left
s.air(78, 32, 14, 8)            # way out on the right
s.rock(76, 40, 16, 2)           # its floor reaches back over the bowl
s.rock(0, 52, 32, 2)            # the landing
s.kills.append((4 * 6, 58 * 6, 86 * 6, 64 * 6))
pts = []
for k in range(23):
    a = math.radians(228 - k * 11)
    pts.append((44 + 31 * math.cos(a), 36 - 17 * math.sin(a)))
for (x, y) in pts:
    s.shelf(int(round(x)) - 2, int(round(y)), 4, way=True)
for k in range(3):
    s.orb(44.5, 36.0, 9, 19, 10, 12, k / 3.0, 1.25)
s.hint(14, 4, 'THE   GARDEN   TURNS')
s.tether(88, 40)

# ---------------------------------------------------------------- MIRROR HALL: the beams cross; hide beneath the X
s = new('g9', 'MIRROR HALL', 128, 56, 0.85, 5)
s.cave([(0, 40)], [(0, 14), (8, 22), (120, 14)])
s.ice(8, 40, 112)
for k, x in enumerate((28, 52, 76, 100)):
    prism(s, x - 5, 22, 60, 8, 3, k * 2.0, w=3)
    prism(s, x + 5, 22, 120, 8, 3, k * 2.0, w=3)
s.hint(1, 20, 'THE   BEAMS   CROSS  -  SHELTER   BENEATH   THEM')
s.tether(124)

# ---------------------------------------------------------------- CRYSTAL TREE: from branch to branch
s = new('g10', 'CRYSTAL TREE', 60, 100, 0.9, 3)
blank(s, 90, 24)
s.air(0, 82, 8, 8)              # way in
s.air(6, 10, 48, 82)            # the hollow
s.air(52, 16, 8, 8)             # way out
s.rock(50, 24, 10, 2)
s.rock(6, 90, 48, 4)
s.rock(28, 34, 4, 56)           # the trunk
s.bounce(20, 90, 4)
for k, y in enumerate((81, 72, 63, 54, 45, 36)):
    if k % 2 == 0:
        s.bounce(9, y, 4)
        s.shelf(13, y, 14)
    else:
        s.shelf(8, y, 12)
        s.bounce(20, y, 4)
s.shelf(8, 27, 40)              # the crown, over the trunk
for k in range(2):
    s.orb(30.0, 56.0, 9, 17, 26, 12, k * 0.5, 1.2)
s.hint(1, 79, 'UP   THE   CRYSTAL   TREE')
s.tether(56, 24)

# ---------------------------------------------------------------- UPWARD RAIN: light falls up through the gaps
s = new('g11', 'UPWARD RAIN', 120, 80, 0.95, 1)
s.cave([(0, 40), (8, 70), (112, 40)], [(0, 14), (8, 52), (112, 14)])
s.kills.append((8 * 6, 62 * 6, 112 * 6, 72 * 6))
for k, x in enumerate(range(8, 112, 10)):
    s.shelf(x, 40, 5, way=True)
    if x + 10 < 112:
        s.beam(x + 7.5, 62, 2, 52, per=8, on=3, ph=k * 0.67, ang=270, chimney=False, burn=2.0)
s.hint(1, 20, 'THE   LIGHT   RAINS   UPWARD')
s.tether(116)

# ---------------------------------------------------------------- SHARD FIELD: slick glass between the pits
s = new('g12', 'SHARD FIELD', 150, 60, 0.95, 3)
s.cave([(0, 40)], [(0, 14), (8, 20), (142, 14)])
s.ice(8, 40, 134)
for k, x in enumerate((24, 48, 72, 96, 120)):
    s.pit(x, x + 4, depth=12)
    s.orb(x + 2.0, 33.0, 7, 1, 5, 8, k * 0.25, 1.2)
s.hint(1, 18, 'STOP   BEFORE   THE   EDGE')
s.tether(146)

# ---------------------------------------------------------------- FROST BRIDGE: three stones on the slick bridge
s = new('g13', 'FROST BRIDGE', 130, 72, 0.95, 5)
s.cave([(0, 40), (8, 64), (122, 40)], [(0, 14), (8, 46), (122, 14)])
s.kills.append((8 * 6, 56 * 6, 122 * 6, 66 * 6))
s.rock(8, 40, 114, 2)
s.ice(8, 40, 114)
for k, hx in enumerate((14, 54, 94)):
    q = s.hush(hx, 40, 6)
    for bx in (hx + 14, hx + 24):
        s.beam(bx + 0.5, 18.5, 4, 22, steady=True, burn=4.0)
        s.link(q)
    s.way(hx, 40)
s.hint(1, 18, 'THE   STONES   ARE   SLICK   TOO')
s.tether(126)

# ---------------------------------------------------------------- GLASS ORCHARD: lights orbit the hanging crystals
s = new('g14', 'GLASS ORCHARD', 140, 60, 1.0, 4)
s.cave([(0, 40)], [(0, 14), (8, 18), (132, 14)])
for k, x in enumerate((18, 40, 62, 84, 106)):
    s.rock(x, 18, 3, 13)         # a crystal hanging to row 31
    s.orb(x + 1.5, 27.0, 6, 8, 9, 8, k * 0.2, 1.2)
s.hint(1, 18, 'THE   LIGHTS   ORBIT   THE   CRYSTALS')
s.tether(136)

# ---------------------------------------------------------------- IX THE GREAT LENS: down through four turning eyes
s = new('g8', 'IX  THE GREAT LENS', 96, 84, 1.0, 0)
blank(s, 20, 20)
s.air(0, 12, 8, 8)              # way in
s.air(6, 12, 84, 60)            # the lens
tiers = [(20, 6, 70), (32, 24, 90), (44, 6, 70), (56, 24, 90)]
for (y, x0, x1) in tiers:
    s.rock(x0, y, x1 - x0, 2)
s.rock(6, 70, 84, 4)            # the floor of the lens
for (y, xs) in ((20, (18, 34, 50, 62)), (32, (30, 46, 62, 78)), (44, (14, 30, 46, 62)), (56, (30, 46, 62, 78))):
    for x in xs:
        s.rock(x, y - 2, 2, 2)  # cover, two tiles tall
s.ice(24, 32, 66)
s.ice(24, 56, 66)
for k, (x, y) in enumerate(((46.5, 26.5), (56.5, 38.5), (40.5, 50.5), (60.5, 63.5))):
    s.watch(x, y, 40, 9, 0, 0, 16, k * 4.0, I=2.0, spin=True, burn=1.5)
s.rock(40, 66, 12, 4)
s.rock(43, 64, 6, 2)
s.lamp(46.0, 59.5, 26, 1.0, col='shard', haz=False)
s.goal_at(46.0, 61.0)
s.hint(1, 9, 'DOWN   THROUGH   THE   LENS')
for wx, wy in ((81, 32), (12, 44), (82, 56), (14, 70)):
    s.way(wx, wy)

META = dict(idx=2, name='THE GLASS GARDEN', theme='glass')

if __name__ == '__main__':
    build_level(secs, META)
