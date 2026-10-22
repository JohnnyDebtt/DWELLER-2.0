"""DWELLER — THE DEEP: the endless descent below the Codex.

Six strata, one for each world of the story (the descent, the mycelium, the glass garden, the foundry, ember deep,
the heart), eight rooms in each. A room is a small level of its own: an entrance, three challenges built with that
world's tricks, and a hole in the floor that drops you into the next room. A run strings rooms together at random
(main.js); this file builds every room once, with its own seed, and writes build/deep/<stratum><n>.json.

How hard a room is comes in two parts: `d` (0..1, rising with the room's number) shapes the room itself here, and the
tier (0..4, rising with the size of the Codex) is applied to its lights at run time by Dweller.deepTier, the same
function the bot uses, so every room is proven at every tier.

    python3 tools/deep.py            # all rooms
    python3 tools/deep.py glass 3    # one room
"""
import math
import os
import random
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, assemble, b

STRATA = ['descent', 'mycelium', 'glass', 'foundry', 'ember', 'heart']
NAMES = {'descent': 'THE SHAFT', 'mycelium': 'THE ROOTS', 'glass': 'THE GEODE', 'foundry': 'THE WORKINGS',
         'ember': 'THE MAGMA', 'heart': 'THE VEIN'}
ROOMS = 8
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build', 'deep')


def blank(s, entry, exit_):
    s.floor[0] = entry
    s.floor[s.w - 1] = exit_


def lampS(s, x, y, r, per, on, ph, I=1.2, burn=1.0, warn=0.6, col=None):
    s.lamp(x, y, r, I, sched=dict(per=int(per * 64), len=int(on * 64), ph=int(ph * 64), warn=int(warn * 64)), **({'col': col} if col else {}))
    if burn != 1.0:
        s.lights[-1]['burnMul'] = burn


def prism(s, x, ceil, ang, per, on, ph, w=4, floor=40, burn=4.0, warn=0.75, steady=False):
    y = ceil - 0.6
    ln = (floor - y) / math.sin(math.radians(ang)) + 2
    s.beam(x, y, w, ln, per=per, on=on, ph=ph, ang=ang, chimney='notch', burn=burn, warn=warn, steady=steady)


# ================================================================= the pieces of each stratum
# every piece takes (name, R, d) and returns a Sec whose way in and way out are at floor row 40 unless it says so

# ---- THE DESCENT: the cold upper caves
def d_beams(n, R, d):
    k = 4 + int(round(d * 2))
    w = 20 + k * 14
    s = Sec(n, 'BEAMS', w, 56, dict(e=0.4, root=0))
    s.cave([(0, 40)], [(0, 15)])
    wave = R.random() < 0.5
    for i in range(k):
        x = 14 + i * 14
        ph = -float(i) if wave else R.choice([0, 2, 4, 6]) + (i % 2) * 4
        s.beam(x + 2.5, 22.5, 6, 22, per=8, on=3, ph=ph % 8, burn=4.0)
    s.tether(w - 4)
    return s


def d_crawl(n, R, d):
    k = 2 + int(round(d))
    w = 30 + k * 24
    s = Sec(n, 'THE LOW WAY', w, 60, dict(e=0.4, root=2))
    s.cave([(0, 40), (8, 43), (12, 46), (16, 40)], [(0, 18), (8, 21), (12, 24), (16, 18)])
    xe = 16 + k * 24
    s.air(16, 45, xe - 16, 1)
    for i in range(k):
        x = 26 + i * 24
        s.lamp(x + 0.5, 30.5, 19 + d * 2)
        s.air(x, 40, 1, 5)
    s.air(xe, 40, 4, 6)
    s.plat(xe + 2, 43, 2)
    for wx, wy in [(14.5, 46), (xe - 2, 46), (xe + 2.5, 43), (xe + 7, 40)]:
        s.way(wx, wy)
    s.tether(w - 4)
    return s


def d_watchers(n, R, d):
    k = 2 + int(round(d))
    w = 24 + k * 40
    s = Sec(n, 'EYES', w, 60, dict(e=0.5, root=1))
    s.cave([(0, 40)], [(0, 14), (14, 22), (w - 12, 22), (w - 6, 14)])
    for x in range(10, w - 10, 14):
        s.rock(x, 33, 6, 2)
    for i in range(k):
        s.watch(30.5 + i * 40, 18.5, 33, 13, 90, 50, 10, R.choice([0.0, 3.3, 6.6]), I=2.0, burn=2.0)
    s.tether(w - 4)
    return s


def d_pendulum(n, R, d):
    k = 3 + int(round(d))
    w = 16 + k * 36
    s = Sec(n, 'PENDULUMS', w, 56, dict(e=0.4, root=2))
    s.cave([(0, 40)], [(0, 15)])
    for x in range(16, w - 8, 18):
        s.rock(x, 33, 6, 2)
    for i in range(k):
        s.orb(26.0 + i * 36, 29.5, 22 + d * 2, 11, 2, 8, (i * 0.37) % 1, 1.3)
    s.tether(w - 4)
    return s


def d_drift(n, R, d):
    k = 7 + int(round(d * 3))
    w = 24 + k * 8
    s = Sec(n, 'DRIFT', w, 70, dict(e=0.5, root=5))
    s.cave([(0, 40), (12, 60), (w - 12, 40)], [(0, 22), (12, 42), (w - 12, 22)])
    s.kills.append((12 * 6, 49 * 6, (w - 12) * 6, 62 * 6))
    ys = [40, 38, 36, 38]
    for i in range(k):
        s.plat(15 + i * 8, ys[i % 4], 4 + (i % 2), 2, way=True)
    for i in range(k - 1):
        s.orbline(21.5 + i * 8, 27, 0, 7, 6.5, 8, (i * 0.085 * (1 if R.random() < 0.5 else -1)) % 1)
    s.tether(w - 4)
    return s


def d_hush(n, R, d):
    w = 100
    s = Sec(n, 'THE HUSH', w, 56, dict(e=0.4, root=0))
    s.cave([(0, 40)], [(0, 15)])
    q = s.hush(14, 40, 9.0 - d)
    for x in (24, 32, 40, 48):
        s.beam(x + 0.5, 22.5, 6, 22, steady=True, burn=4.0)
        s.link(q)
    s.lamp(72.5, 32.5, 10)
    s.rock(64, 38, 3, 2)
    s.tether(w - 4)
    return s


# ---- THE MYCELIUM: caps that breathe and caps that bounce
def cap(s, x, floor, r, per, on, ph, I=1.1, warn=0.75):
    lampS(s, x, floor - 1.5, r, per, on, ph, I, warn=warn, col='cap')


def m_caps(n, R, d):
    k = 4 + int(round(d * 2))
    w = 20 + k * 14
    s = Sec(n, 'BREATHING CAPS', w, 60, dict(e=0.4, root=0))
    s.cave([(0, 40)], [(0, 16)])
    for i in range(k):
        cap(s, 16.5 + i * 14, 40, 10, 6, 3, (i * 3) % 6)
        if i % 2 == 1:
            s.rock(16 + i * 14 + 6, 38, 3, 2)
    s.tether(w - 4)
    return s


def m_canopy(n, R, d):
    k = 6 + int(round(d * 2))
    w = 12 + k * 11
    s = Sec(n, 'THE CANOPY', w, 72, dict(e=0.5, root=1))
    s.cave([(0, 30), (6, 62), (w - 10, 30)], [(0, 14), (6, 50), (w - 10, 18)])
    s.kills.append((6 * 6, 47 * 6, (w - 10) * 6, 64 * 6))
    for i in range(k):
        x = 10 + i * 11
        if i % 2 == 0:
            s.bounce(x, 36, 5, 2)
        else:
            s.plat(x, 30 - (i % 4 == 3) * 2, 6, 2, way=True)
    for i in range(k // 2):
        s.orb(15.5 + i * 22, 21, 8, 6, 3, 8, (i * 0.25) % 1, 1.2)
    s.tether(w - 6, 30)
    blank_exit = 30
    s.floor[w - 1] = blank_exit
    return s


def m_ladder(n, R, d):
    s = Sec(n, 'GILL LADDER', 42, 92, dict(e=0.45, root=4))
    s.cave([(0, 82), (34, 16)], [(0, 8), (8, 70), (34, 8)])
    rows = list(range(79, 15, -3))
    for k2, y in enumerate(rows):
        if k2 % 2 == 0:
            s.shelf(9, y, 10, way=True)
        else:
            s.shelf(23, y, 11, way=True)
    for k2, y in enumerate((70, 52, 34)):
        lampS(s, 21.5, y + 0.5, 11, 8, 2.5 + 0.5 * d, k2 * 8 / 3.0, I=1.1, warn=0.75)
    s.tether(38)
    return s


def m_hyphae(n, R, d):
    s = Sec(n, 'HYPHAE', 92, 72, dict(e=0.5, root=5))
    s.cave([(0, 30), (8, 62), (82, 30)], [(0, 14), (8, 48), (82, 14)])
    s.kills.append((8 * 6, 47 * 6, 82 * 6, 64 * 6))
    for x in (14, 22, 30, 38, 54, 62, 70, 77):
        s.vine(x, 14, 34)
    s.plat(44, 30, 6, 2, way=True)
    for k2, x in enumerate((26, 34, 58, 66)):
        s.orbline(x + 0.5, 15, 0, 16, 7, 8, (k2 * 0.25 + R.choice([0, 0.5])) % 1, 1.2)
    cap(s, 46.5, 30, 9, 8, 3, 2)
    s.tether(86, 30)
    return s


def m_spores(n, R, d):
    k = 3 + int(round(d * 2))
    w = 24 + k * 20
    s = Sec(n, 'SPORE CLOUD', w, 60, dict(e=0.45, root=3))
    s.cave([(0, 40)], [(0, 18)])
    for i in range(k):
        lampS(s, 20.5 + i * 20, 25.5, 13, 8, 3, (i * 2.67) % 8, I=1.1)
        s.rock(28 + i * 20, 37, 4, 3)
        s.shelf(28 + i * 20, 33, 4)
    s.tether(w - 4)
    return s


# ---- THE GLASS GARDEN: slick floors, prisms, hush stones
def g_prisms(n, R, d):
    k = 3 + int(round(d * 2))
    w = 24 + k * 18
    s = Sec(n, 'PRISMS', w, 56, dict(e=0.45, root=3))
    s.cave([(0, 40)], [(0, 15)])
    s.ice(10, 40, w - 20)
    for i in range(k):
        prism(s, 22 + i * 18, 25, R.choice([60, 120]), 8, 3, (i * 2.5) % 8)
    s.tether(w - 4)
    return s


def g_well(n, R, d):
    s = Sec(n, 'PRISM WELL', 38, 100, dict(e=0.5, root=3))
    blank(s, 90, 40)
    s.air(0, 82, 8, 8)
    s.air(6, 10, 22, 80)
    s.air(28, 32, 10, 8)
    for k2, y in enumerate(range(90, 40, -8)):
        s.bounce(17 if k2 % 2 == 0 else 8, y, 5, 2)
    s.rock(28, 40, 10, 2)
    s.air(24, 32, 4, 8)
    for k2, y in enumerate((76, 58)):
        s.air(2, y - 1, 4, 3)
        s.beam(3.5, y + 0.5, 3, 26, per=8, on=3, ph=k2 * 2.67, ang=0, chimney=False, burn=1.5)
    s.tether(33, 40)
    return s


def g_garden(n, R, d):
    w = 112
    s = Sec(n, 'HUSH GARDEN', w, 56, dict(e=0.45, root=5))
    s.cave([(0, 40)], [(0, 15)])
    s.ice(8, 40, 96)
    for k2, x0 in enumerate((14, 50, 86)):
        q = s.hush(x0, 40, 6.5 - d)
        for x in (x0 + 10, x0 + 20):
            prism(s, x, 25, 60 if k2 % 2 else 120, 8, 3, 0, steady=True)
            s.link(q)
    s.tether(w - 4)
    return s


def g_eyes(n, R, d):
    k = 2 + int(round(d))
    w = 30 + k * 40
    s = Sec(n, 'TWIN EYES', w, 60, dict(e=0.55, root=1))
    s.cave([(0, 40)], [(0, 14), (14, 22), (w - 12, 22), (w - 6, 14)])
    s.ice(8, 40, w - 16)
    for x in range(12, w - 10, 13):
        s.rock(x, 34, 5, 1)
        s.rock(x + 1, 33, 3, 1)
    for i in range(k):
        s.watch(32.5 + i * 40, 18.5, 32, 12, 90, 55, 9, (i * 4.5) % 9, I=2.0, burn=2.0)
    s.tether(w - 4)
    return s


def g_shards(n, R, d):
    k = 4 + int(round(d))
    w = 30 + k * 24
    s = Sec(n, 'SHARD FIELD', w, 60, dict(e=0.5, root=4))
    s.cave([(0, 40)], [(0, 14), (8, 20), (w - 8, 14)])
    s.ice(8, 40, w - 16)
    for i in range(k):
        x = 20 + i * 24
        s.pit(x, x + 4, depth=12)
        s.orb(x + 2.0, 33.0, 7, 1, 5, 8, (i * 0.25) % 1, 1.2)
    s.tether(w - 4)
    return s


# ---- THE FOUNDRY: pistons, furnaces, vents and things that swing
def furnace(s, x, y, r, per, on, ph, I=1.2, burn=1.5, warn=0.5):
    lampS(s, x, y, r, per, on, ph, I, burn=burn, warn=warn)


def f_pistons(n, R, d):
    k = 5 + int(round(d * 2))
    w = 24 + k * 16
    s = Sec(n, 'PISTONS', w, 56, dict(e=0.5, root=4))
    s.cave([(0, 40)], [(0, 15)])
    for i in range(k):
        x0 = 14 + i * 16
        s.beam(x0 + 4.0, 22.5, 8, 22, per=8, on=3, ph=(i * 1.5) % 8, warn=0.75, burn=4.0)
        if i < k - 1:
            s.pit(x0 + 9, x0 + 15, depth=12)
            s.plat(x0 + 9, 38, 6, 1)
            s.way(x0 + 12, 38)
    s.tether(w - 4)
    return s


def f_stack(n, R, d):
    s = Sec(n, 'THE STACK', 40, 104, dict(e=0.5, root=2))
    blank(s, 94, 40)
    s.air(0, 86, 8, 8)
    s.air(6, 30, 22, 64)
    s.air(28, 32, 12, 8)
    s.vent(7, 66, 94, 6)
    s.shelf(15, 68, 11, way=True)
    s.vent(19, 44, 68, 6)
    s.shelf(6, 46, 11, way=True)
    s.vent(7, 38, 46, 6)
    s.shelf(14, 40, 14, way=True)
    for k2, (x, y) in enumerate(((22, 82), (12, 58))):
        furnace(s, x + 0.5, y + 0.5, 11, 4, 2, k2 * 1.33)
    s.tether(34, 40)
    return s


def f_yard(n, R, d):
    k = 3 + int(round(d))
    w = 24 + k * 30
    s = Sec(n, 'SCRAPYARD', w, 64, dict(e=0.5, root=2))
    s.cave([(0, 40)], [(0, 16)])
    for i in range(k + 1):
        s.rock(12 + i * 30, 36, 4, 4)
    for i in range(k):
        s.orbline(17 + i * 30, 29, 24, 0, 10, 6, (i * 0.3) % 1, 1.3)
    s.tether(w - 4)
    return s


def f_furnaces(n, R, d):
    k = 4 + int(round(d * 2))
    w = 20 + k * 16
    s = Sec(n, 'FURNACE ROW', w, 56, dict(e=0.5, root=0))
    s.cave([(0, 40)], [(0, 15)])
    for i in range(k):
        x = 16 + i * 16
        furnace(s, x + 0.5, 32.5, 10 + d, 4, 2, (i * 2) % 4)
        s.rock(x + 7, 37, 3, 3)
    s.tether(w - 4)
    return s


def f_crane(n, R, d):
    w = 130
    s = Sec(n, 'CRANE YARD', w, 64, dict(e=0.55, root=2))
    s.cave([(0, 40)], [(0, 18)])
    for x in range(14, w - 10, 16):
        s.air(x, 40, 2, 3)
        s.air(x, 42, 5, 3)
        s.way(x + 3.5, 45)
    for k2 in range(2):
        s.orbline(10, 30, w - 20, 0, 12, 8, k2 * 0.5, 1.3)
        s.lights[-1]['burnMul'] = 2.0
    s.tether(w - 4)
    return s


# ---- EMBER DEEP: embers that rise, suns, the shadow of stone
def ember(s, x, y0, rise, r, per, ph, I=1.2):
    s.orbline(x, y0, 0, -rise, r, per, ph, I)


def e_cinders(n, R, d):
    k = 4 + int(round(d * 2))
    w = 20 + k * 16
    s = Sec(n, 'CINDERS', w, 56, dict(e=0.45, root=0))
    s.cave([(0, 40)], [(0, 15)])
    for i in range(k):
        ember(s, 18.5 + i * 16, 38, 12, 9, 6, (i * 0.5) % 1)
        s.rock(25 + i * 16, 37, 3, 3)
    s.tether(w - 4)
    return s


def e_sun(n, R, d):
    w = 140
    s = Sec(n, 'THE BURIED SUN', w, 70, dict(e=0.5, root=4))
    s.cave([(0, 40), (12, 44), (128, 40)], [(0, 14), (12, 32), (128, 14)])
    s.lamp(70.5, 16.5, 42, 1.25)
    for x in (36, 50, 64, 78, 92):
        s.plat(x, 40, 7, 1)
    s.rock(106, 41, 3, 3)
    s.rock(26, 41, 3, 3)
    s.rock(125, 42, 3, 2)
    ember(s, 57.5, 42, 10, 7, 5, 0.0)
    ember(s, 85.5, 42, 10, 7, 5, 0.5)
    for wx in (39, 53, 67, 81, 95):
        s.way(wx + 0.5, 44)
    s.tether(132)
    return s


def e_vents(n, R, d):
    s = Sec(n, 'ASH VENTS', 60, 104, dict(e=0.55, root=2))
    blank(s, 86, 40)
    s.air(0, 78, 8, 8)
    s.air(6, 32, 48, 66)
    s.air(48, 32, 12, 8)
    s.lamp(30.5, 95.5, 52, 1.1)
    s.lights[-1]['burnMul'] = 0.7
    s.kills.append((6 * 6, 92 * 6, 54 * 6, 99 * 6))
    ledges = [(86, 'L'), (72, 'R'), (58, 'L'), (40, 'R')]
    for k2, (y, side) in enumerate(ledges):
        if side == 'L':
            s.rock(6, y, 19, 2)
        else:
            s.rock(35, y, 25 if k2 == len(ledges) - 1 else 19, 2)
    for k2 in range(len(ledges) - 1):
        y0, side = ledges[k2]
        y1 = ledges[k2 + 1][0]
        x = 24 if side == 'L' else 31
        s.vent(x, y1 - 5, y0, 5)
        s.way(16 if side == 'L' else 44, y0)
    s.tether(56, 40)
    return s


def e_chains(n, R, d):
    s = Sec(n, 'THE CHAINS', 60, 108, dict(e=0.55, root=1))
    blank(s, 96, 40)
    s.air(0, 88, 10, 8)
    s.air(8, 32, 44, 64)
    s.air(48, 32, 12, 8)
    s.kills.append((10 * 6, 96 * 6, 50 * 6, 104 * 6))
    s.rock(8, 96, 6, 2)
    s.rock(44, 40, 16, 2)
    for x in (16, 25, 34, 43):
        s.vine(x, 35, 96)
    for k2, x in enumerate((20, 29, 38)):
        s.orbline(x + 0.5, 50, 0, 40, 8, 8, (k2 * 0.33) % 1, 1.2)
    s.tether(56, 40)
    return s


def e_falls(n, R, d):
    k = 4 + int(round(d * 2))
    w = 24 + k * 18
    s = Sec(n, 'ASH FALLS', w, 60, dict(e=0.5, root=3))
    s.cave([(0, 40)], [(0, 16)])
    for i in range(k):
        x = 16 + i * 18
        s.orbline(x + 0.5, 25, 0, 13, 8, 6, (i * 0.21) % 1, 1.2)
        s.rock(x + 8, 37, 3, 3)
    s.tether(w - 4)
    return s


# ---- THE HEART: lights that beat
def beat(s, x, y, r, per, on, ph, I=1.2, burn=1.5, warn=0.4):
    lampS(s, x, y, r, per, on, ph, I, burn=burn, warn=warn)


def h_valves(n, R, d):
    k = 4 + int(round(d * 2))
    w = 20 + k * 18
    s = Sec(n, 'VALVES', w, 56, dict(e=0.5, root=0))
    s.cave([(0, 40)], [(0, 15)])
    for i in range(k):
        x = 18 + i * 18
        beat(s, x + 0.5, 31.5, 10, 4, 1.25, (i * 2) % 4)
        s.rock(x + 9, 37, 2, 3)
    s.tether(w - 4)
    return s


def h_ventricles(n, R, d):
    s = Sec(n, 'VENTRICLES', 132, 60, dict(e=0.55, root=5))
    blank(s, 40, 40)
    s.air(0, 32, 126, 8)
    s.air(4, 44, 128, 6)
    s.air(126, 32, 6, 8)
    for x in (14, 34, 54, 74, 94, 114):
        s.air(x, 40, 4, 4)
        s.shelf(x, 40, 4)
        s.bounce(x, 50, 4, 1)
    for k2, x in enumerate((24, 44, 64, 84, 104)):
        beat(s, x + 0.5, 35.5, 11, 4, 1.5, 0.0, burn=1.2, warn=0.6)
        beat(s, x + 10.5, 46.5, 11, 4, 1.5, 2.0, burn=1.2, warn=0.6)
    s.tether(128, 40)
    return s


def h_pulse(n, R, d):
    w = 110 + int(d * 30)
    s = Sec(n, 'THE PULSE', w, 56, dict(e=0.6, root=3))
    s.cave([(0, 40)], [(0, 14), (8, 22), (w - 8, 14)])
    for x in range(14, w - 10, 12):
        s.air(x, 40, 2, 3)
        s.air(x, 42, 5, 3)
        s.way(x + 3.5, 45)
    for k2 in range(2):
        s.orbline(8, 34, w - 16, 0, 11, 8, k2 * 0.5, 1.4)
        s.lights[-1]['burnMul'] = 2.4
    s.tether(w - 4)
    return s


def h_hushvalves(n, R, d):
    w = 120
    s = Sec(n, 'THE VALVE ROOM', w, 56, dict(e=0.5, root=4))
    s.cave([(0, 40)], [(0, 16)])
    for k2, x0 in enumerate((12, 48, 84)):
        q = s.hush(x0, 40, 6.0 - d)
        for x in (x0 + 12, x0 + 24):
            beat(s, x + 0.5, 30.5, 13, 2, 1.5, 0.0, I=1.3, warn=0.0)
            s.link(q)
    s.tether(w - 4)
    return s


def h_arrhythmia(n, R, d):
    k = 4 + int(round(d * 2))
    w = 24 + k * 18
    s = Sec(n, 'ARRHYTHMIA', w, 56, dict(e=0.6, root=3))
    s.cave([(0, 40)], [(0, 15)])
    for i in range(k):
        x = 16 + i * 18
        per = R.choice([4, 6, 8])
        beat(s, x + 0.5, 31.5, 11, per, 1.5 + (per > 4) * 0.5, R.choice([0, 1, 2, 3]) % per, warn=0.5)
        s.rock(x + 9, 37, 2, 3)
    s.tether(w - 4)
    return s


PIECES = {
    'descent': [d_beams, d_crawl, d_watchers, d_pendulum, d_drift, d_hush],
    'mycelium': [m_caps, m_canopy, m_ladder, m_hyphae, m_spores],
    'glass': [g_prisms, g_well, g_garden, g_eyes, g_shards],
    'foundry': [f_pistons, f_stack, f_yard, f_furnaces, f_crane],
    'ember': [e_cinders, e_sun, e_vents, e_chains, e_falls],
    'heart': [h_valves, h_ventricles, h_pulse, h_hushvalves, h_arrhythmia],
}


# ================================================================= a room: in, three pieces, a gate to the next
def entrance(n, last):
    s = Sec(n, 'IN', 26, 56, dict(e=0.3, root=0))
    s.cave([(0, 40)], [(0, 14), (6, 16)])
    s.spawn_at(5)
    return s


def way_down(n, final):
    """the gate into the next room, standing on the floor: walk through it (the game lights it in the colour of the
    room beyond). In the last room of a run (main.js marks it) the find waits there instead"""
    s = Sec(n, 'DOWN', 30, 60, dict(e=0.3, root=0))
    s.cave([(0, 40)], [(0, 15)])
    s.goal_at(16.0, 39.0)
    return s


def build_room(stratum, i):
    R = random.Random(hash((stratum, i, 'deep')) & 0xffffffff)
    R.seed('%s-%d' % (stratum, i))
    d = i / (ROOMS - 1)
    lib = PIECES[stratum]
    # every room of a stratum gets its own three pieces (a different trio each), in its own order
    import itertools
    trios = list(itertools.combinations(range(len(lib)), 3))
    random.Random('trios-' + stratum).shuffle(trios)
    trio = list(trios[i % len(trios)])
    R.shuffle(trio)
    picks = [lib[k] for k in trio]
    rid = '%s%d' % (stratum, i)
    secs = [entrance(rid + 'a', False)]
    for j, f in enumerate(picks):
        secs.append(f('%s_%d' % (rid, j), R, d))
    secs.append(way_down(rid + 'z', False))
    os.makedirs(OUT, exist_ok=True)
    meta = dict(theme=stratum, deep=True, name=NAMES[stratum], stratum=STRATA.index(stratum), room=i, idx=STRATA.index(stratum))
    lv = assemble(secs, os.path.join(OUT, '%s.json' % rid), os.path.join(OUT, 'preview', rid), meta)
    print('%-10s %3d x %3d  lights %2d  %s' % (rid, lv['w'], lv['h'], len(lv['lights']), ' + '.join(p.__name__ for p in picks)))
    return lv


if __name__ == '__main__':
    if len(sys.argv) > 2:
        build_room(sys.argv[1], int(sys.argv[2]))
    else:
        for st in STRATA:
            for i in range(ROOMS):
                build_room(st, i)
