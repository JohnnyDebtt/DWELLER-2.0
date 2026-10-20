"""DWELLER — Level VII: THE CORE. Behind the door of six slivers, a Guardian of four turning shields keeps the
heart of the planet. Set the six slivers in its six alcoves, in order, while its gaze sweeps the arena; each one
changes how it looks. Then it shatters, the floor gives way, and its light floods down after you."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from levelkit import Sec, build_level

secs = []


def new(name, title, w, hs, e, root):
    s = Sec(name, title, w, hs, dict(e=e, root=root))
    secs.append(s)
    return s


def blank(s, entry, exit_):
    s.floor[0] = entry
    s.floor[s.w - 1] = exit_


# ---------------------------------------------------------------- I THE DOOR
s = new('k0', 'I  THE DOOR', 64, 56, 0.3, 0)
s.cave([(0, 40)], [(0, 14), (12, 18), (56, 14)])
s.spawn_at(6)
s.hint(14, 20, 'SET   THE   SIX   SLIVERS')
s.hint(14, 23, 'ONE   BY   ONE', cmp=None)
s.hint(30, 29, 'E   COVERS   ITS   EYE', cmp=True)

# ---------------------------------------------------------------- II THE GUARDIAN
s = new('k1', 'II  THE GUARDIAN', 150, 172, 1.0, 0)
blank(s, 86, 86)
s.air(0, 78, 8, 8)              # in from the door
s.air(6, 6, 138, 80)            # the arena, rows 6..85

# the Guardian, its reach, where the flood starts, and where it wakes
s.lights.append(dict(t='gcore', x=75.0, y=46.0, r=80, top=6, wake=10))

def alcove(n, x, y):
    s.lights.append(dict(t='alcove', n=n, x=x, y=y))

# the route crosses the arena again and again:
#   1 floor, left  ->  2 the far end of the high bridge  ->  3 the right ledge (checkpoint)
#   4 the left ledge, all the way back  ->  5 the middle of the bridge, over the eye  ->  6 down past the eye to the pedestal
s.rock(17, 79, 10, 2)
alcove(0, 22.0, 86)
for x in (46, 104):
    s.rock(x, 79, 6, 2)         # two awnings along the floor: the only shade down there

# the left wall: a vine in the shadow of a spine, up to a ledge
s.vine(12, 26, 84)
for y0 in (34, 54, 72):
    s.rock(16, y0, 2, 8)        # a broken spine: the vine is shaded only in places
s.rock(6, 30, 5, 2)
s.rock(14, 30, 14, 2)
alcove(3, 22.0, 30)

# the hot draught up past a second spine, onto the broken bridge under the roof
s.vent(28, 9, 31, 4)
s.rock(32, 22, 2, 8)
# the high way is mostly glass shelves: they hold you up, but the gaze comes straight through
s.rock(32, 12, 8, 2)
s.shelf(40, 12, 16)
s.rock(56, 12, 4, 2)
s.shelf(60, 12, 14)
s.rock(74, 12, 9, 2)
s.ice(74, 12, 9)
alcove(4, 78.0, 12)             # over the eye, on slick glass
s.shelf(83, 12, 21)
s.rock(104, 12, 4, 2)
s.shelf(108, 12, 2)
s.rock(110, 12, 6, 2)
alcove(1, 112.0, 12)
s.shelf(116, 12, 14)

# down the right wall, ledge by ledge, behind a spine
for y0 in (20, 40, 58):
    s.rock(127, y0, 2, 8)       # a broken spine down the right wall
for k, y in enumerate((24, 32, 40, 48, 56, 63)):
    s.rock(130 if k % 2 == 0 else 136, y, 7, 1)
s.rock(129, 70, 14, 2)
alcove(2, 136.0, 70)
s.tether(136, 70)               # earned by the third sliver, not by touch

# down past the eye: stepping stones from the bridge to the pedestal, open to its gaze
for (x, y) in ((51, 24), (43, 36), (51, 48), (59, 60)):
    s.rock(x, y, 6, 2)

# the pedestal under the eye; a cap throws you up to it from the floor. It is also the plug over the shaft.
s.bounce(83, 86, 4)
s.fake(70, 77, 11, 12, 'plug')
alcove(5, 75.5, 77)

# the shaft below, and the dark at its bottom
s.air(70, 89, 11, 73)
s.rock(70, 104, 6, 1)
s.rock(75, 120, 6, 1)
s.rock(70, 136, 6, 1)
s.rock(75, 150, 6, 1)
s.lamp(75.5, 155.5, 30, 1.0, col="shard", haz=False)
s.goal_at(75.5, 160.0)

s.hint(8, 74, 'IT   WAKES')
s.hint(56, 70, 'SEEK   A   COMPANION', cmp=False)   # only the SEEKER can cover its eye long enough
# resting places in shadow, for the solver
for wx, wy in ((22, 86), (14, 30), (24, 30), (36, 12), (57, 12), (75, 12), (106, 12), (112, 12), (133, 24), (139, 32), (133, 40), (139, 48), (133, 56), (139, 63), (136, 70), (124, 86), (107, 86), (49, 86), (22, 86), (14, 30), (22, 30), (36, 12), (57, 12), (78, 12), (53, 24), (45, 36), (53, 48), (61, 60)):
    s.way(wx, wy)

META = dict(idx=6, name='THE CORE', theme='core', final=True)

if __name__ == '__main__':
    lv = build_level(secs, META)
    # the route doubles back, so the solver gets its resting places per half, in order
    import json
    path = os.path.join(os.path.dirname(__file__), '..', 'build', 'level7.json')
    L = json.load(open(path))
    ways = L['ways']
    cut = next(i for i, wp in enumerate(ways) if abs(wp[0] - L['checks'][1]['x']) < 20 and abs(wp[1] - L['checks'][1]['y']) < 20)
    L['waysBySeg'] = [ways[:cut], ways[cut + 1:]]
    json.dump(L, open(path, 'w'), separators=(',', ':'))
