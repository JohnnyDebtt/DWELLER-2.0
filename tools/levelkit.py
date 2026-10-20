"""Level toolkit for DWELLER: sections are floor plans; the kit stitches them into one map.

Units: tiles (6 px). y grows downward. A column's floor row f means rows >= f are rock and the
player stands on the surface at y = f. A column's ceiling row c means rows < c are rock.
Light positions are in tile coordinates (x.5 / y.5 is the centre of a tile).
"""
import json
import numpy as np

TS = 6
BEAT = 64  # ticks per beat at 90 BPM / 96 Hz


def b(beats):
    return int(round(beats * BEAT))


class Sec:
    def __init__(self, name, title, w, hs, music):
        self.name, self.title, self.w, self.hs, self.music = name, title, w, hs, music
        self.g = np.ones((hs, w), dtype=np.uint8)
        self.floor = [None] * w
        self.ceil = [None] * w
        self.lights, self.checks, self.hints, self.kills = [], [], [], []
        self.spawn = None
        self.goal = None
        self.decor = []
        self.ops = []
        self.ways = []
        self.fakes = []
        self.secret = None
        self.tiles = dict(oneway=[], bounce=[], ice=[])
        self.vines, self.vents, self.switches = [], [], []

    # ---- caves
    def cave(self, floor, height):
        """floor: [(x0,row)...] ; height: [(x0,tiles)...] ceiling = floor - height per column."""
        def expand(segs, n):
            out = [None] * n
            for i, (x0, v) in enumerate(segs):
                x1 = segs[i + 1][0] if i + 1 < len(segs) else n
                for x in range(x0, min(x1, n)):
                    out[x] = v
            return out
        f = expand(floor, self.w)
        h = expand(height, self.w)
        for x in range(self.w):
            self.floor[x] = f[x]
            self.ceil[x] = f[x] - h[x]
            self.g[self.ceil[x]:f[x], x] = 0

    def rock(self, x, y, w, h):
        self.g[y:y + h, x:x + w] = 1

    def air(self, x, y, w, h):
        self.g[y:y + h, x:x + w] = 0

    def plat(self, x, y, w, t=1, way=False):
        self.g[y:y + t, x:x + w] = 1
        if way:
            self.ways.append((x + w / 2.0, y))

    def way(self, x, y):
        """Waypoint for the test bot: feet position (tile x, surface row)."""
        self.ways.append((x, y))

    def pillar(self, x, w, top):
        f = self.floor[x]
        self.g[top:f, x:x + w] = 1

    def pit(self, x0, x1, depth=12, kill=3):
        """Open a pit under columns [x0,x1). Death zone starts `kill` rows under the rim."""
        rim = self.floor[x0 - 1] if x0 > 0 else self.floor[x0]
        self.g[rim:rim + depth, x0:x1] = 0
        for x in range(x0, x1):
            self.floor[x] = rim + depth
        self.kills.append((x0 * TS, (rim + kill) * TS, x1 * TS, (rim + depth + 2) * TS))

    def fake(self, x, y, w, h, tag=None):
        """A false wall: drawn as rock, but the Dweller walks through it. A tag ('plug', 'nocmp') hands it to the
        Guardian, which makes it solid or opens it as the fight goes."""
        self.g[y:y + h, x:x + w] = 0
        self.fakes.append((x, y, w, h) if tag is None else (x, y, w, h, tag))

    # ---- terrain features
    def shelf(self, x, y, w, way=False):
        """a one-way shelf whose top is row y: jump up through it, stand on it, press down to drop"""
        self.g[y, x:x + w] = 0
        self.tiles['oneway'].append((x, y, w))
        if way:
            self.ways.append((x + w / 2.0, y))

    def bounce(self, x, y, w, t=1, way=False):
        """a bounce cap: solid, its top is row y; landing on it throws you up (hold jump to go higher)"""
        self.g[y:y + t, x:x + w] = 1
        self.tiles['bounce'].append((x, y, w))

    def ice(self, x, y, w):
        """slick glass on the rock surface row y (the row of rock under the feet)"""
        self.tiles['ice'].append((x, y, w))

    def vine(self, x, y0, y1, w=1):
        """a climbable strand covering rows y0..y1-1 (hold up to climb)"""
        self.g[y0:y1, x:x + w] = 0
        self.vines.append((x, y0, w, y1 - y0))

    def vent(self, x, y0, y1, w):
        """rising air over columns x..x+w, rows y0..y1-1"""
        self.vents.append((x, y0, w, y1 - y0))

    def hush(self, x, y, beats):
        """a hush stone on the surface row y; returns its id for lights (sw=...) it silences for `beats`"""
        self.switches.append((x, y, int(beats * 64)))
        return len(self.switches) - 1

    def link(self, k, n=1):
        """link the last n lights to hush stone k"""
        for L in self.lights[-n:]:
            L['sw'] = k

    def secret_at(self, x, y):
        self.secret = (x, y)

    # ---- entities
    def spawn_at(self, x):
        self.spawn = (x + 0.5, self.floor[int(x)])
        self.tether(x)

    def tether(self, x, y=None):
        self.checks.append((x + 0.5, self.floor[int(x)] if y is None else y))

    def goal_at(self, x, y):
        self.goal = (x, y)

    def hint(self, x, y, text, cmp=None):
        """cmp=True: only shown with the SEEKER; cmp=False: only shown without it."""
        self.hints.append((x, y, text, cmp))

    def lamp(self, x, y, r, I=1.0, sched=None, col='cold', haz=True):
        d = dict(t='lamp', x=x, y=y, r=r, I=I, sched=sched, col=col)
        if not haz:
            d['hazard'] = False
        self.lights.append(d)

    def orb(self, x, y, r, rx, ry, per, ph=0.0, I=1.0, sched=None):
        self.lights.append(dict(t='orb', x=x, y=y, r=r, I=I, sched=sched, col='orb',
                                move=dict(k='ellipse', rx=rx, ry=ry, per=b(per), ph=ph)))

    def orbline(self, x, y, dx, dy, r, per, ph=0.0, I=1.0):
        self.lights.append(dict(t='orb', x=x, y=y, r=r, I=I, col='orb',
                                move=dict(k='line', dx=dx, dy=dy, per=b(per), ph=ph)))

    def watch(self, x, y, r, half, base, amp, per, ph=0.0, I=1.0, spin=False, burn=1.0):
        d = np.pi / 180.0
        self.lights.append(dict(t='watch', x=x, y=y, r=r, I=I, half=half * d, base=base * d,
                                amp=amp * d, per=b(per), ph=ph, spin=spin, col='watch', burnMul=burn))

    def beam(self, x, y, w, ln, per=8, on=3, ph=0.0, ang=90, I=1.0, warn=0.75, chimney=True, steady=False, burn=1.0):
        """x,y = centre of the source slit; w = width in tiles (perpendicular to travel)."""
        d = dict(t='beam', x=x, y=y, w=w, ln=ln, ang=ang * np.pi / 180.0, I=I, col='beam', burnMul=burn)
        if not steady:
            d['sched'] = dict(per=b(per), len=b(on), ph=b(ph), warn=b(warn))
        self.lights.append(d)
        if chimney and ang == 90:
            x0 = int(round(x - w / 2.0))
            c = self.ceil[int(x)]
            self.g[int(y - 0.5):c, x0:x0 + int(w)] = 0
        elif chimney == 'notch':
            # an angled slot cut into the rock, so the emitter sits recessed in the ceiling
            r = ang * np.pi / 180.0
            dx, dy, nx, ny = np.cos(r), np.sin(r), -np.sin(r), np.cos(r)
            for k in range(int(w * 10) + 1):
                tt = -w / 2.0 + w * k / (w * 10)
                for back in (0.0, 0.35, 0.7, 1.05, 1.4):
                    px, py = x + nx * tt - dx * back, y + ny * tt - dy * back
                    self.g[int(np.floor(py)), int(np.floor(px))] = 0

    # ---- helpers
    def entry(self):
        return self.floor[0]

    def exit(self):
        return self.floor[self.w - 1]


def sched(per, on, ph=0.0, warn=0.75):
    return dict(per=b(per), len=b(on), ph=b(ph), warn=b(warn))


def assemble(sections, out_path, preview_dir=None, meta=None):
    offs = []
    oy = 0
    ox = 0
    for i, s in enumerate(sections):
        if i > 0:
            oy = oy + sections[i - 1].exit() - s.entry()
        offs.append((ox, oy))
        ox += s.w
    W = ox
    top = min(o[1] for o in offs)
    bot = max(o[1] + s.hs for o, s in zip(offs, sections))
    PAD_T, PAD_B = 6, 6
    shift = PAD_T - top
    H = (bot - top) + PAD_T + PAD_B
    G = np.ones((H, W), dtype=np.uint8)
    for (sx, sy), s in zip(offs, sections):
        G[sy + shift:sy + shift + s.hs, sx:sx + s.w] = s.g
    # soften ceilings: add hanging bumps where there is lots of headroom (never into the walking space)
    rng = np.random.default_rng(48)
    for x in range(1, W - 1):
        # find topmost air cell per column
        col = G[:, x]
        air = np.where(col == 0)[0]
        if len(air) == 0:
            continue
        top_air = air[0]
        # only deepen big caves
        run = 0
        y = top_air
        while y < H and G[y, x] == 0:
            run += 1
            y += 1
        if run >= 15 and rng.random() < 0.20:
            n = 1 if rng.random() < 0.7 else 2
            G[top_air:top_air + n, x] = 1

    lights, checks, hints, kills, music, secs, ways = [], [], [], [], [], [], []
    fakes = []
    tiles = dict(oneway=[], bounce=[], ice=[])
    vines, vents, switches = [], [], []
    spawn = goal = secret = None
    for i, ((sx, sy), s) in enumerate(zip(offs, sections)):
        gy = sy + shift
        secs.append(dict(name=s.name, title=s.title, x0=sx, x1=sx + s.w, music=s.music))
        for L in s.lights:
            d = dict(L)
            d['x'] = round((sx + L['x']) * TS, 2)
            d['y'] = round((gy + L['y']) * TS, 2)
            for k in ('r',):
                if k in d:
                    d[k] = round(d[k] * TS, 2)
            if 'top' in d:
                d['top'] = round((gy + d['top']) * TS, 2)
            if 'wake' in d:
                d['wake'] = round((sx + d['wake']) * TS, 2)
            if d['t'] == 'beam':
                d['w'] = round(d['w'] * TS, 2)
                d['len'] = round(d.pop('ln') * TS, 2)
            if d['t'] == 'orb':
                m = dict(d['move'])
                for k in ('rx', 'ry', 'dx', 'dy'):
                    if k in m:
                        m[k] = round(m[k] * TS, 2)
                d['move'] = m
            if d.get('sched') is None:
                d.pop('sched', None)
            if 'sw' in d:
                d['sw'] = d['sw'] + len(switches)
            lights.append(d)
        for (cx, cyr) in s.checks:
            checks.append(dict(x=round((sx + cx) * TS, 2), y=round((gy + cyr) * TS, 2)))
        for (hx, hy, t, hc) in s.hints:
            d = dict(x=round((sx + hx) * TS, 2), y=round((gy + hy) * TS, 2), text=t)
            if hc is not None:
                d['cmp'] = bool(hc)
            hints.append(d)
        for (wx, wy) in s.ways:
            ways.append([round((sx + wx) * TS, 2), round((gy + wy) * TS, 2)])
        for (a, bb, c, d2) in s.kills:
            kills.append([sx * TS + a, gy * TS + bb, sx * TS + c, gy * TS + d2])
        for f in s.fakes:
            fakes.append([sx + f[0], gy + f[1], f[2], f[3]] + list(f[4:]))
        sw0 = len(switches)
        for k in tiles:
            for (tx, ty, tw) in s.tiles[k]:
                tiles[k].append([sx + tx, gy + ty, tw])
        for (vx, vy, vw, vh) in s.vines:
            vines.append([sx + vx, gy + vy, vw, vh])
        for (vx, vy, vw, vh) in s.vents:
            vents.append([sx + vx, gy + vy, vw, vh])
        for (hx, hy, dur) in s.switches:
            switches.append(dict(x=round((sx + hx) * TS, 2), y=round((gy + hy) * TS, 2), dur=dur))
        if s.secret:
            secret = dict(x=round((sx + s.secret[0]) * TS, 2), y=round((gy + s.secret[1]) * TS, 2))
        if s.spawn:
            spawn = dict(x=round((sx + s.spawn[0]) * TS, 2), y=round((gy + s.spawn[1]) * TS, 2))
        if s.goal:
            goal = dict(x=round((sx + s.goal[0]) * TS, 2), y=round((gy + s.goal[1]) * TS, 2))
    checks.sort(key=lambda c: c['x'])
    for i, c in enumerate(checks):
        c['i'] = i

    rows = []
    for y in range(H):
        runs = []
        cur = 0
        n = 0
        for x in range(W):
            v = int(G[y, x])
            if v == cur:
                n += 1
            else:
                runs.append(n)
                cur = v
                n = 1
        runs.append(n)
        rows.append(runs)

    level = dict(w=W, h=H, rows=rows, lights=lights, checks=checks, goal=goal, spawn=spawn,
                 sections=secs, hints=hints, kills=kills, ways=ways, fakes=fakes,
                 tiles=tiles, vines=vines, vents=vents, switches=switches)
    if secret:
        level['secret'] = secret
    if meta:
        level.update(meta)
    with open(out_path, 'w') as f:
        json.dump(level, f, separators=(',', ':'))

    if preview_dir:
        import os
        os.makedirs(preview_dir, exist_ok=True)
        for (sx, sy), s in zip(offs, sections):
            gy = sy + shift
            lines = []
            marks = {}
            for L in lights:
                gx = int(L['x'] // TS)
                gyy = int(L['y'] // TS)
                if sx <= gx < sx + s.w and gy <= gyy < gy + s.hs:
                    marks[(gx - sx, gyy - gy)] = {'lamp': 'L', 'orb': 'O', 'watch': 'W', 'beam': 'B', 'gcore': 'G', 'alcove': 'A'}[L['t']]
            for c in checks:
                gx = int(c['x'] // TS)
                gyy = int(c['y'] // TS) - 1
                if sx <= gx < sx + s.w and gy <= gyy < gy + s.hs:
                    marks[(gx - sx, gyy - gy)] = 'T'
            if goal:
                gx = int(goal['x'] // TS)
                gyy = int(goal['y'] // TS)
                if sx <= gx < sx + s.w and gy <= gyy < gy + s.hs:
                    marks[(gx - sx, gyy - gy)] = 'G'
            if spawn:
                gx = int(spawn['x'] // TS)
                gyy = int(spawn['y'] // TS) - 1
                if sx <= gx < sx + s.w and gy <= gyy < gy + s.hs:
                    marks[(gx - sx, gyy - gy)] = 'S'
            for (fx, fy, fw, fh, *_) in s.fakes:
                for yy in range(fy, fy + fh):
                    for xx in range(fx, fx + fw):
                        marks.setdefault((xx, yy), 'f')
            if s.secret:
                marks[(int(s.secret[0]), int(s.secret[1]) - 1)] = '$'
            for (tx, ty, tw) in s.tiles['oneway']:
                for xx in range(tx, tx + tw): marks[(xx, ty)] = '='
            for (tx, ty, tw) in s.tiles['bounce']:
                for xx in range(tx, tx + tw): marks[(xx, ty)] = '^'
            for (tx, ty, tw) in s.tiles['ice']:
                for xx in range(tx, tx + tw): marks[(xx, ty)] = '~'
            for (vx, vy, vw, vh) in s.vines:
                for yy in range(vy, vy + vh): marks.setdefault((vx, yy), '|')
            for (vx, vy, vw, vh) in s.vents:
                for yy in range(vy, vy + vh):
                    for xx in range(vx, vx + vw): marks.setdefault((xx, yy), ':')
            for (hx, hy, dur) in s.switches:
                marks[(int(hx), int(hy) - 1)] = 'H'
            ys = [y for y in range(s.hs) if (G[gy + y, sx:sx + s.w] == 0).any()]
            y0, y1 = (min(ys) - 2, max(ys) + 3) if ys else (0, s.hs)
            y0 = max(0, y0)
            y1 = min(s.hs, y1)
            for y in range(y0, y1):
                line = ''.join(marks.get((x, y), '#' if G[gy + y, sx + x] else '.') for x in range(s.w))
                lines.append('%3d %s' % (gy + y, line))
            with open(os.path.join(preview_dir, '%s.txt' % s.name), 'w') as f:
                f.write('\n'.join(lines))
    return level


def build_level(secs, meta):
    """Write build/level<N>.json and its ascii previews; print a summary."""
    import os
    n = meta['idx'] + 1
    # number the sections in order, so inserting one renumbers the rest
    R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII']
    for i, s in enumerate(secs):
        name = s.title.split('  ', 1)[1] if '  ' in s.title else s.title
        s.title = R[i] + '  ' + name
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')
    os.makedirs(out, exist_ok=True)
    lv = assemble(secs, os.path.join(out, 'level%d.json' % n), os.path.join(out, 'preview', 'l%d' % n), meta)
    print('level %d %s: %d x %d, lights %d, checks %d, sections %d' % (n, meta['name'], lv['w'], lv['h'], len(lv['lights']), len(lv['checks']), len(secs)))
    return lv
