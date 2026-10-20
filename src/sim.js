/* DWELLER — simulation core. Pure logic, no DOM: runs in the browser and in Node (for the test bot).
 *
 * Resonance with The Seeker: the simulation ticks at 96 Hz, animation steps at 12 fps (8 ticks),
 * the tempo is 90 BPM (one beat = 64 ticks), tiles are 6 px and the Seeker is two tiles tall.
 * Every light that pulses does so on whole beats. Running speed is exactly 8 tiles per beat.
 */
(function (global) {
  'use strict';

  const TS = 6;                 // tile size in px
  const TICK = 96;              // simulation Hz
  const DT = 1 / TICK;
  const BEAT = 64;              // ticks per beat at 90 BPM
  const IN = { L: 1, R: 2, J: 4, D: 8, E: 16 };
  const EV = { JUMP: 1, LAND: 2, ROLL: 4, WJUMP: 8, DEATH: 16, RESPAWN: 32, CHECK: 64, WIN: 128, HARDLAND: 256, SEEKER: 512, ECLIPSE: 1024, ECLFAIL: 2048, ECLEND: 4096, BOUNCE: 8192, HUSH: 16384, GRAB: 32768, SLIVER: 65536, BURST: 131072, THROES: 262144 };

  const C = {
    W: 5, H: 10, HR: 5,                      // hitbox: standing 5x10, rolling 5x5
    RUN: 72, CRAWL: 46,
    GACC: 1100, GFRIC: 1500, AACC: 760, AFRIC: 420,
    JUMPV: 150, GU: 540, GD: 650, CUT: 2.7, MAXFALL: 215, APEXV: 26, APEXG: 0.62,
    COYOTE: 9, BUFFER: 10,
    WSLIDE: 34, WJX: 86, WJY: 144, WLOCK: 11, WCOY: 7,
    ROLLV: 108, ROLLT: 33, ROLLCD: 20,
    BURN: 0.95, REGEN: 0.9, DEADT: 104, GRACE: 64,
    LITLO: 0.10, LITHI: 0.50,
    // the SEEKER companion: flies to a light and covers it (an eclipse)
    CMPV: 2.9, CMPHOLD: 480, CMPCD: 224, CMPR: 120,
    // terrain features of the deeper levels
    BOUNCE: 262, ICEACC: 0.16, ICEFRIC: 0.06, CLIMBUP: 44, CLIMBDN: 80, SHIMMY: 38, SNAPV: 90, LEAN: 1.5, SPRK: 170, SPRD: 16, SWAYMAX: 2.4,
    VENTACC: 1500, VENTMAX: 150, DROP: 10,
  };
  const TT = { ONEWAY: 1, BOUNCE: 2, ICE: 3 };

  const EPS = 1e-4;

  function smooth(e0, e1, x) {
    let t = (x - e0) / (e1 - e0);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t * (3 - 2 * t);
  }

  /* ------------------------------------------------------------------ world */

  function decodeRows(level) {
    const W = level.w, H = level.h;
    const solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const runs = level.rows[y];
      let x = 0, v = 0;           // runs alternate: air, rock, air, rock...
      for (let i = 0; i < runs.length; i++) {
        const n = runs[i];
        if (v) solid.fill(1, y * W + x, y * W + x + n);
        x += n; v ^= 1;
      }
    }
    return solid;
  }

  function makeWorld(level) {
    const w = {
      W: level.w, H: level.h,
      solid: decodeRows(level),
      killY: level.h * TS + 40,
      lights: [], hazards: [],
      checks: level.checks.map(c => ({ x: c.x, y: c.y, i: c.i })),
      goal: level.goal, spawn: level.spawn, kills: level.kills || [],
      sections: level.sections, hints: level.hints, level,
      fakes: level.fakes || [], secret: level.secret || null,
      tt: new Uint8Array(level.w * level.h), vine: new Uint8Array(level.w * level.h), vent: new Uint8Array(level.w * level.h),
      switches: (level.switches || []).map((q, i) => Object.assign({ i }, q)),
    };
    const T = level.tiles || {};
    const put = (arr, v, runs) => (runs || []).forEach(([x, y, n, h]) => { for (let yy = y; yy < y + (h || 1); yy++) for (let xx = x; xx < x + n; xx++) if (xx >= 0 && yy >= 0 && xx < w.W && yy < w.H) arr[yy * w.W + xx] = v; });
    put(w.tt, TT.ONEWAY, T.oneway); put(w.tt, TT.BOUNCE, T.bounce); put(w.tt, TT.ICE, T.ice);
    put(w.vine, 1, level.vines); put(w.vent, 1, level.vents);
    w.hasOneway = !!(T.oneway && T.oneway.length); w.hasVine = !!(level.vines && level.vines.length);
    w.hasVent = !!(level.vents && level.vents.length); w.hasTT = !!(T.bounce && T.bounce.length) || !!(T.ice && T.ice.length);
    // the Guardian: its marker and its six alcoves come in the light list but are not lights
    const markers = level.lights.filter(d => d.t === 'gcore' || d.t === 'alcove');
    level = Object.assign({}, level, { lights: level.lights.filter(d => d.t !== 'gcore' && d.t !== 'alcove') });
    w.level = level;
    if (markers.length) buildBoss(w, level, markers);
    level.lights.forEach((d, i) => {
      const l = Object.assign({ id: i, hazard: true, I: 1, k: 1 }, d);
      l.bx = l.x; l.by = l.y;            // anchor
      if (l.t === 'beam') {
        const a = l.ang === undefined ? Math.PI / 2 : l.ang;
        l.ang = a; l.dx = Math.cos(a); l.dy = Math.sin(a); l.nx = -l.dy; l.ny = l.dx;
        l.reach = l.len + l.w;
      } else if (l.t === 'watch') {
        l.reach = l.r;
      } else {
        l.reach = l.r + (l.move ? Math.max(Math.abs(l.move.rx || l.move.dx || 0), Math.abs(l.move.ry || l.move.dy || 0)) + 2 : 0);
      }
      w.lights.push(l);
      if (l.hazard) w.hazards.push(l);
    });
    if (w.boss) for (const l of w.boss.lights) { l.id = w.lights.length; w.lights.push(l); w.hazards.push(l); }
    updateLights(w, 0);
    return w;
  }

  /* ------------------------------------------------------------- the Guardian (level VII)
   * A Guardian of four rotating shields floats in the middle of the arena. Its gaze leaves through the four gaps
   * between the shields. Six alcoves wait for the six slivers, in order; each one changes how it looks:
   *   I   it learns to look: it turns faster          II  the room breathes: the gaze's reach swells and ebbs
   *   III prisms split each beam in two (checkpoint)  IV  the gaze pulses on the beat, and turns faster again
   *   V   every eight beats it flares like a sun      VI  its rhythm stumbles, it shatters, and the floor opens
   * The SEEKER's eclipse covers the whole eye; each eclipse teaches it to turn faster and glare wider afterwards. */
  const GB = { SPIN: Math.PI * 2 / 960, HALF: 0.2, GAPS: [-0.87, 0.70, 2.27, 3.84], SPLIT: 0.27, BREATH: 384,
    FLARE_PER: 512, FLARE_WARN: 64, FLARE_ON: 44, THROES: 160, FLOODV: 1.5, GLARE: 110, SET: 40 };
  function buildBoss(w, level, markers) {
    const core = markers.find(d => d.t === 'gcore');
    const alc = markers.filter(d => d.t === 'alcove').sort((a, b) => a.n - b.n).map(d => ({ x: d.x, y: d.y, n: d.n }));
    const B = { x: core.x, y: core.y, r: core.r, top: core.top, alc, lights: [], cones: [], mid: -1, plug: [], nocmp: [] };
    for (let i = 0; i < 8; i++) {
      const l = { t: 'watch', boss: 'gaze', x: B.x, y: B.y, bx: B.x, by: B.y, r: B.r, half: GB.HALF, ang: 0, base: 0, amp: 0, per: 1e9, I: 2.0, k: 0, burnMul: 2.2, hazard: true, reach: B.r };
      B.lights.push(l); B.cones.push(l);
    }
    B.flare = { t: 'lamp', boss: 'flare', x: B.x, y: B.y, bx: B.x, by: B.y, r: B.r * 1.15, I: 1.5, k: 0, burnMul: 3.0, hazard: true, reach: B.r * 1.15 };
    B.flood = { t: 'flood', boss: 'flood', x: B.x, y: B.y, bx: B.x, by: B.y, r: 1e6, I: 1, k: 0, fy: -1e9, burnMul: 4, hazard: true, reach: 1e7 };
    B.lights.push(B.flare, B.flood);
    for (const f of level.fakes || []) { if (f[4] === 'plug') B.plug.push(f); if (f[4] === 'nocmp') B.nocmp.push(f); }
    B.wake = core.wake !== undefined ? core.wake : alc[0].x - 90;
    // the checkpoint that the third sliver earns
    let bd = 1e9; w.checks.forEach((c, i) => { const d = Math.hypot(c.x - alc[2].x, c.y - alc[2].y); if (d < bd) { bd = d; B.mid = i; } });
    w.boss = B; w.plugSolid = false; w.nocmpSolid = false;
    setRegions(w, B.plug, true); w.plugSolid = true;
  }
  function setRegions(w, list, v) {
    for (const f of list) for (let y = f[1]; y < f[1] + f[3]; y++) for (let x = f[0]; x < f[0] + f[2]; x++) if (x >= 0 && y >= 0 && x < w.W && y < w.H) w.solid[y * w.W + x] = v ? 1 : 0;
  }
  function stumble(beat) { let h = (beat * 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h & 1023) / 1023; }
  function stepBoss(w, s) {
    const B = w.boss; if (!B) return;
    if (!s.bInit) {
      s.bInit = 1; s.bP = s.cp >= B.mid && B.mid >= 0 ? 3 : 0; s.bWake = s.bP > 0 ? 1 : 0; s.bAng = 0; s.bT = 0;
      s.bEcl = 0; s.bGlare = 0; s.bDie = 0; s.bBurst = 0; s.bWasEcl = 0;
    }
    // the floor over the shaft holds until the Guardian shatters; the companion-less cover only stands without the SEEKER
    const plug = !s.bBurst; if (plug !== w.plugSolid) { setRegions(w, B.plug, plug); w.plugSolid = plug; }
    const noc = !s.cmp; if (noc !== w.nocmpSolid) { setRegions(w, B.nocmp, noc); w.nocmpSolid = noc; }
    const cx = s.x + C.W / 2, fy = s.y + s.h;
    if (!s.bWake && !s.dead && cx > B.wake) s.bWake = 1;
    if (s.bWake) s.bT++;
    const P = s.bP, t = s.bT;
    // placing the next sliver
    const A = B.alc[P];
    // a sliver takes a moment to set: stand in the alcove until it takes
    // the last alcove lies open under the eye: only with the SEEKER covering it can the sliver be set
    const at = A && s.bWake && !s.dead && s.onG && Math.abs(cx - A.x) < 9 && Math.abs(fy - A.y) < 3 && (P < 5 || s.cmp);
    s.bSet = at ? (s.bSet || 0) + 1 : 0;
    if (at && s.bSet >= GB.SET) {
      s.bSet = 0; s.bP = P + 1; s.ev |= EV.SLIVER; s.sliverI = P;
      if (s.bP === 3 && B.mid >= 0) { const c = w.checks[B.mid]; s.cp = B.mid; s.cpX = c.x; s.cpY = c.y; s.ev |= EV.CHECK; s.ex = Math.max(0, s.ex - 0.5); }
      if (s.bP === 6) { s.bDie = 1; s.ev |= EV.THROES; }
    }
    // learning from the eclipse
    const ecl = s.cmpL >= 0 && w.lights[s.cmpL] && w.lights[s.cmpL].boss && s.cmp === 3;
    if (ecl && !s.bWasEcl) s.bEcl++;
    if (!ecl && s.bWasEcl) s.bGlare = GB.GLARE;
    s.bWasEcl = ecl ? 1 : 0;
    if (s.bGlare > 0) s.bGlare--;
    // how fast it turns
    let spin = GB.SPIN * (P >= 1 ? 1.25 : 1) * (P >= 4 ? 1.18 : 1) * (1 + 0.07 * Math.min(5, s.bEcl));
    let dir = 1;
    if (s.bDie) {
      s.bDie++;
      const beat = Math.floor(s.bDie / 20);
      dir = stumble(beat + 7) < 0.5 ? -1 : 1; spin *= 2.2 + 2 * stumble(beat);
      if (s.bDie === GB.THROES) { s.bBurst = s.t; s.ev |= EV.BURST; }
    }
    if (s.bWake && !s.bBurst) s.bAng += spin * dir;
    // the gaze
    const breath = P >= 2 ? 0.5 - 0.5 * Math.cos(t / GB.BREATH * Math.PI * 2) : 0.5;
    const reach = B.r * (P >= 2 ? 0.72 + 0.4 * breath : 1);
    let half = GB.HALF * (P >= 2 ? 0.85 + 0.3 * breath : 1) * (s.bGlare > 0 ? 1.55 : 1);
    let gain = s.bWake && !s.bBurst ? Math.min(1, t / 96) : 0;
    if (P >= 4 && !s.bDie) { const ph = t % 64; gain *= ph < 40 ? 1 : ph < 46 ? 1 - (ph - 40) / 6 : ph > 58 ? (ph - 58) / 6 : 0; }
    if (s.bDie) gain *= 0.25 + 0.2 * Math.sin(s.bDie * 0.9);
    const split = P >= 3;
    for (let i = 0; i < 8; i++) {
      const l = B.cones[i], g = i >> 1, side = i & 1;
      if (!split && side) { l.k = 0; continue; }
      l.ang = s.bAng + GB.GAPS[g] + (split ? (side ? 1 : -1) * GB.SPLIT : 0);
      l.half = split ? half * 0.72 : half; l.r = reach; l.reach = reach; l.k = gain;
    }
    // the sun-flare
    B.flare.k = 0;
    if (P >= 5 && !s.bDie && s.bWake) {
      const ph = t % GB.FLARE_PER, on0 = GB.FLARE_PER - GB.FLARE_ON;
      if (ph >= on0) B.flare.k = Math.min(1, (ph - on0) / 6);
      else if (ph >= on0 - GB.FLARE_WARN) { const q = ph - (on0 - GB.FLARE_WARN); B.flare.k = 0.06 + 0.04 * Math.sin(q * 0.6); }
    }
    s.bFlareWarn = P >= 5 && !s.bDie ? (t % GB.FLARE_PER) - (GB.FLARE_PER - GB.FLARE_ON - GB.FLARE_WARN) : -1;
    // the flood after it shatters
    if (s.bBurst) { const e = s.t - s.bBurst - 64; B.flood.k = e > 0 ? 1 : 0; B.flood.fy = B.top + Math.max(0, e) * GB.FLOODV; }
    else { B.flood.k = 0; B.flood.fy = -1e9; }
    // the eclipse covers the eye: every beam and the flare
    if (s.cmpL >= 0 && s.cmpK > 0 && w.lights[s.cmpL] && w.lights[s.cmpL].boss) for (const l of B.lights) if (l.boss !== 'flood') l.k *= 1 - s.cmpK;
  }

  function ttAt(w, tx, ty) { return tx < 0 || ty < 0 || tx >= w.W || ty >= w.H ? 0 : w.tt[ty * w.W + tx]; }
  /* one-way shelves: only the tile row exactly under the feet counts, and only from above */
  function onOneway(w, s) {
    if (!w.hasOneway || s.drop > 0) return false;
    const b = s.y + s.h, ty = Math.round(b / TS);
    if (Math.abs(b - ty * TS) > 0.02) return false;
    const x0 = Math.floor(s.x / TS), x1 = Math.floor((s.x + C.W - EPS) / TS);
    for (let tx = x0; tx <= x1; tx++) if (ttAt(w, tx, ty) === TT.ONEWAY) return true;
    return false;
  }
  /* the floor tile type under the feet (bounce caps, glass) */
  function floorType(w, s) {
    const ty = Math.floor((s.y + s.h + 0.5) / TS), cx = Math.floor((s.x + C.W / 2) / TS);
    const a = ttAt(w, cx, ty);
    if (a) return a;
    const x0 = Math.floor(s.x / TS), x1 = Math.floor((s.x + C.W - EPS) / TS);
    return ttAt(w, x0, ty) || ttAt(w, x1, ty);
  }
  function inMask(w, m, s) {
    const tx = Math.floor((s.x + C.W / 2) / TS), ty = Math.floor((s.y + s.h / 2) / TS);
    return tx >= 0 && ty >= 0 && tx < w.W && ty < w.H && m[ty * w.W + tx] === 1;
  }

  /* is there room to step off a strand toward dir, with something to stand on just below? */
  function ledgeBeside(w, s, dir) {
    const nx = s.x + dir * (C.W + 1);
    if (rectSolid(w, nx, s.y, C.W, s.h)) return false;
    const fy = s.y + s.h, x0 = Math.floor(nx / TS), x1 = Math.floor((nx + C.W - EPS) / TS);
    for (let ty = Math.floor(fy / TS); ty <= Math.floor((fy + 4 * TS) / TS); ty++)
      for (let tx = x0; tx <= x1; tx++) if (solidAt(w, tx, ty) || ttAt(w, tx, ty) === TT.ONEWAY) return true;
    return false;
  }

  function solidAt(w, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= w.W) return true;
    if (ty >= w.H) return false;      // below the map is open void
    return w.solid[ty * w.W + tx] === 1;
  }

  function rectSolid(w, x, y, ww, hh) {
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + ww - EPS) / TS);
    const y0 = Math.floor(y / TS), y1 = Math.floor((y + hh - EPS) / TS);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (solidAt(w, tx, ty)) return true;
    return false;
  }

  /* Distance along a ray to the first solid tile (Amanatides & Woo). maxD in px. */
  function castRay(w, ox, oy, dx, dy, maxD) {
    let tx = Math.floor(ox / TS), ty = Math.floor(oy / TS);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const tdx = adx < 1e-9 ? 1e30 : TS / adx, tdy = ady < 1e-9 ? 1e30 : TS / ady;
    let tmx = adx < 1e-9 ? 1e30 : ((dx > 0 ? (tx + 1) * TS - ox : ox - tx * TS) / adx);
    let tmy = ady < 1e-9 ? 1e30 : ((dy > 0 ? (ty + 1) * TS - oy : oy - ty * TS) / ady);
    let t = 0;
    for (let i = 0; i < 400; i++) {
      if (tmx < tmy) { t = tmx; tmx += tdx; tx += sx; } else { t = tmy; tmy += tdy; ty += sy; }
      if (t >= maxD) return maxD;
      if (solidAt(w, tx, ty)) return t;
    }
    return maxD;
  }

  function rayClear(w, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.5) return true;
    return castRay(w, x0, y0, dx / d, dy / d, d) >= d - 0.01;
  }

  /* -------------------------------------------------------------- lights */

  const RISE = 8, FALL = 14;

  function schedGain(s, t) {
    if (!s) return 1;
    const per = s.per, tau = ((t + (s.ph || 0)) % per + per) % per;
    const warn = s.warn === undefined ? 48 : s.warn;
    if (tau < s.len) {
      let k = 1;
      if (tau < RISE) k = smooth(0, RISE, tau);
      else if (tau > s.len - FALL) k = 1 - smooth(s.len - FALL, s.len, tau);
      return k;
    }
    if (warn > 0 && tau >= per - warn) {
      const q = tau - (per - warn);      // gentle flicker that is visible but harmless
      return 0.07 + 0.045 * Math.sin(q * 0.55) * Math.sin(q * 0.23 + 1);
    }
    return 0;
  }

  function updateLights(w, t) {
    const lights = w.lights;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      if (l.boss) continue;
      l.k = schedGain(l.sched, t);
      const m = l.move;
      if (m) {
        const ph = (t / m.per + (m.ph || 0)) * Math.PI * 2;
        if (m.k === 'ellipse') {
          l.x = l.bx + m.rx * Math.cos(ph); l.y = l.by + m.ry * Math.sin(ph);
        } else { // 'line': ping-pong with ease
          const s = 0.5 - 0.5 * Math.cos(ph);
          l.x = l.bx + m.dx * s; l.y = l.by + m.dy * s;
        }
      }
      if (l.t === 'watch') {
        const ph = (t / l.per + (l.ph || 0)) * Math.PI * 2;
        l.ang = l.spin ? l.base + ph : l.base + l.amp * Math.sin(ph);
      }
    }
  }

  /* Light intensity at a point, 0..1, occlusion included. */
  function lightAt(w, l, px, py) {
    if (l.k <= 0.001) return 0;
    if (l.t === 'flood') return py < l.fy ? l.k : py < l.fy + 18 ? l.k * (1 - (py - l.fy) / 18) : 0;
    if (l.t === 'beam') {
      const rx = px - l.x, ry = py - l.y;
      const s = rx * l.dx + ry * l.dy, v = rx * l.nx + ry * l.ny;
      const hw = l.w / 2;
      if (s < 0 || s > l.len || v < -hw || v > hw) return 0;
      const sx = l.x + l.nx * v, sy = l.y + l.ny * v;
      if (!rayClear(w, sx, sy, px, py)) return 0;
      const lat = 1 - smooth(0.78, 1.0, Math.abs(v) / hw);
      return l.I * l.k * lat * (1 - 0.4 * (s / l.len));
    }
    const dx = px - l.x, dy = py - l.y, d2 = dx * dx + dy * dy;
    if (d2 > l.r * l.r) return 0;
    const d = Math.sqrt(d2);
    let f = 1 - smooth(0.30 * l.r, l.r, d);
    if (l.t === 'watch') {
      let da = Math.atan2(dy, dx) - l.ang;
      da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
      if (da > l.half) return 0;
      f *= 1 - smooth(0.62 * l.half, l.half, da);
      f *= 1 - 0.0 * d;
    }
    if (f <= 0.001) return 0;
    if (!rayClear(w, l.x, l.y, px, py)) return 0;
    return l.I * l.k * f;
  }

  const SAMPLE_STAND = [[0, -3.6], [0, 0], [0, 3.6], [-2, -1.5], [2, -1.5], [-2, 2], [2, 2]];
  const SAMPLE_LOW = [[0, 0], [-1.8, 0], [1.8, 0]];

  function playerLit(w, s) {
    const cx = s.x + C.W / 2, cy = s.y + s.h / 2;
    const pts = s.h > C.HR + 0.1 ? SAMPLE_STAND : SAMPLE_LOW;
    let sum = 0, bn = 0, bd = 0;
    const hz = w.hazards;
    for (let k = 0; k < pts.length; k++) {
      const px = cx + pts[k][0], py = cy + pts[k][1];
      let best = 0, bl = null;
      for (let i = 0; i < hz.length; i++) {
        const l = hz[i];
        const rr = l.reach;
        if (px < l.x - rr || px > l.x + rr || py < l.y - rr || py > l.y + rr) continue;
        const v = lightAt(w, l, px, py);
        if (v > best) { best = v; bl = l; }
      }
      sum += best;
      if (bl) { bn += best * (bl.burnMul || 1); bd += best; }
    }
    w.lastBM = bd > 0 ? bn / bd : 1;
    return sum / pts.length;
  }

  /* ------------------------------------------------------------- state */

  function newState(w, opts) {
    const sp = w.spawn;
    const cmp = opts && opts.companion ? 1 : 0;
    return {
      cmp, cmpX: sp.x - 9, cmpY: sp.y - 22, cmpL: -1, cmpT: 0, cmpCD: 0, cmpK: 0,
      t: 0, ticks: 0,
      x: sp.x - C.W / 2, y: sp.y - C.H, h: C.H, vx: 0, vy: 0,
      onG: false, face: 1, coy: 0, buf: 0, wallDir: 0, wcoy: 0, wlock: 0, wdir: 0,
      roll: 0, rollDir: 1, rollCD: 0, crawl: false, prev: 0,
      ex: 0, lit: 0, deadT: 0, dead: false, grace: C.GRACE, deathX: 0, deathY: 0,
      cp: -1, cpX: sp.x, cpY: sp.y,
      won: false, wonT: 0, deaths: 0, ev: 0, anim: 0, st: 'idle', airT: 0, landV: 0, why: '',
      fromSt: 'idle', faceT: 0, ajump: false, climb: false, drop: 0, vineCD: 0,
    };
  }

  function cloneState(s) { return Object.assign({}, s); }

  function canStand(w, s) { return !rectSolid(w, s.x, s.y + s.h - C.H, C.W, C.H); }

  function setH(s, h) { s.y += s.h - h; s.h = h; }

  function moveX(w, s, dx) {
    if (dx === 0) return false;
    s.x += dx;
    if (!rectSolid(w, s.x, s.y, C.W, s.h)) return false;
    // auto step-up for one-tile lips when grounded
    if (s.onG && s.vy >= 0) {
      for (let up = 1; up <= TS; up++) {
        if (!rectSolid(w, s.x, s.y - up, C.W, s.h)) { s.y -= up; return false; }
      }
    }
    if (dx > 0) s.x = Math.floor((s.x + C.W) / TS) * TS - C.W;
    else s.x = (Math.floor(s.x / TS) + 1) * TS;
    return true;
  }

  function moveY(w, s, dy) {
    if (dy === 0) return 0;
    const b0 = s.y + s.h;
    s.y += dy;
    if (!rectSolid(w, s.x, s.y, C.W, s.h)) {
      if (dy > 0 && w.hasOneway && !(s.drop > 0)) {
        const b1 = s.y + s.h, r0 = Math.ceil((b0 - 0.02) / TS), r1 = Math.floor(b1 / TS);
        const x0 = Math.floor(s.x / TS), x1 = Math.floor((s.x + C.W - EPS) / TS);
        for (let ty = r0; ty <= r1; ty++) {
          if (ty * TS < b0 - 0.02 || ty * TS > b1) continue;
          for (let tx = x0; tx <= x1; tx++) if (ttAt(w, tx, ty) === TT.ONEWAY) { s.y = ty * TS - s.h; return 1; }
        }
      }
      return 0;
    }
    if (dy < 0) {
      // corner correction: slide round a ledge by up to 3px
      for (let n = 1; n <= 3; n++) {
        if (!rectSolid(w, s.x + n, s.y, C.W, s.h)) { s.x += n; return 0; }
        if (!rectSolid(w, s.x - n, s.y, C.W, s.h)) { s.x -= n; return 0; }
      }
      s.y = (Math.floor(s.y / TS) + 1) * TS;
      return -1;
    }
    s.y = Math.floor((s.y + s.h) / TS) * TS - s.h;
    return 1;
  }

  function killPlayer(s, why) {
    if (s.dead) return;
    s.dead = true; s.deadT = 0; s.vx = 0; s.vy = 0; s.why = why;
    s.deaths++; s.ev |= EV.DEATH; s.deathX = s.x + C.W / 2; s.deathY = s.y + s.h;
    s.st = 'death'; s.anim = 0; s.roll = 0; s.crawl = false;
  }

  function respawn(s) {
    s.x = s.cpX - C.W / 2; s.h = C.H; s.y = s.cpY - C.H;
    s.vx = s.vy = 0; s.dead = false; s.ex = 0; s.lit = 0; s.grace = C.GRACE;
    s.roll = 0; s.crawl = false; s.rollCD = 0; s.wlock = 0; s.coy = 0; s.buf = 0;
    s.st = 'idle'; s.anim = 0; s.ev |= EV.RESPAWN;
    for (let i = 0; i < 8; i++) if (s['hs' + i]) s['hs' + i] = 0;
    s.climb = false; s.drop = 0; s.bInit = 0;
    if (s.cmp) { s.cmp = 1; s.cmpL = -1; s.cmpK = 0; s.cmpT = 0; s.cmpX = s.cpX - 9; s.cmpY = s.cpY - 22; }
  }

  /* ---- hush stones: standing on one silences its lights for a while (timers live in the state, hs0..hs7) */
  const HUSH_FADE = 6, HUSH_WARN = 48;
  function stepSwitches(w, s) {
    const sw = w.switches;
    if (!sw.length) return;
    const cx = s.x + C.W / 2, fy = s.y + s.h;
    for (let i = 0; i < sw.length; i++) {
      const q = sw[i], k = 'hs' + i;
      let v = s[k] || 0;
      if (v > 0) v--;
      if (!s.dead && v === 0 && Math.abs(cx - q.x) < 10 && Math.abs(fy - q.y) < 2.5) { v = q.dur; s.ev |= EV.HUSH; s.hushI = i; }
      s[k] = v;
    }
    const L = w.lights;
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      if (l.sw === undefined) continue;
      const v = s['hs' + l.sw] || 0;
      if (v <= 0) continue;
      const q = sw[l.sw], el = q.dur - v;
      const off = Math.min(1, el / HUSH_FADE) * Math.min(1, v / HUSH_WARN);
      l.k *= 1 - off;
    }
  }

  /* ---- the companion: pick the light that is hurting the most, else the nearest one */
  function pickEclipse(w, s) {
    const cx = s.x + C.W / 2, cy = s.y + s.h / 2;
    let best = -1, bv = 0, near = -1, nd = C.CMPR;
    const hz = w.hazards;
    for (let i = 0; i < hz.length; i++) {
      const l = hz[i];
      const v = lightAt(w, l, cx, cy);
      if (v > bv + 1e-6) { bv = v; best = l.id; }
      const d = Math.hypot(l.x - cx, l.y - cy) / (l.boss === 'gaze' ? 5 : 1);
      if (l.boss === 'flood') continue;
      if (d < nd) { nd = d; near = l.id; }
    }
    return bv > 0.02 ? best : near;
  }
  function stepCompanion(w, s, inp) {
    if (!s.cmp) return;
    const ePress = (inp & IN.E) && !(s.prev & IN.E);
    if (s.cmpCD > 0) s.cmpCD--;
    const px = s.x + C.W / 2, py = s.y + s.h / 2;
    const home = () => [px - s.face * 9, py - 13 + Math.sin(s.t * 0.05) * 1.5];
    const fly = (tx, ty) => {
      const dx = tx - s.cmpX, dy = ty - s.cmpY, d = Math.hypot(dx, dy);
      if (d <= C.CMPV) { s.cmpX = tx; s.cmpY = ty; return true; }
      s.cmpX += dx / d * C.CMPV; s.cmpY += dy / d * C.CMPV; return false;
    };
    if (s.cmp === 1) {
      const h = home();
      s.cmpX += (h[0] - s.cmpX) * 0.09; s.cmpY += (h[1] - s.cmpY) * 0.09;
      if (s.cmpK > 0) { s.cmpK = Math.max(0, s.cmpK - 0.125); if (s.cmpK === 0) s.cmpL = -1; }
      if (ePress && !s.dead) {
        if (s.cmpCD > 0) s.ev |= EV.ECLFAIL;
        else {
          const id = pickEclipse(w, s);
          if (id >= 0) { s.cmp = 2; s.cmpL = id; s.cmpK = 0; s.ev |= EV.ECLIPSE; } else s.ev |= EV.ECLFAIL;
        }
      }
    } else if (s.cmp === 2) {
      const l = w.lights[s.cmpL];
      if (fly(l.x, l.y)) { s.cmp = 3; s.cmpT = C.CMPHOLD; }
    } else if (s.cmp === 3) {
      const l = w.lights[s.cmpL];
      s.cmpX = l.x; s.cmpY = l.y;
      s.cmpK = Math.min(1, s.cmpK + 1 / 6);
      if (--s.cmpT <= 0) { s.cmp = 4; s.cmpCD = C.CMPCD; s.ev |= EV.ECLEND; }
    } else if (s.cmp === 4) {
      if (s.cmpK > 0) s.cmpK = Math.max(0, s.cmpK - 0.125);
      const h = home();
      if (fly(h[0], h[1])) { s.cmp = 1; if (s.cmpK === 0) s.cmpL = -1; }
    }
    if (s.cmpL >= 0 && s.cmpK > 0) w.lights[s.cmpL].k *= (1 - s.cmpK);
  }

  /* One simulation tick. inp is a bitmask of IN flags. Returns the state (mutated). */
  function step(w, s, inp) {
    s.ev = 0;
    if (s.won) { s.wonT++; s.t++; updateLights(w, s.t); stepSwitches(w, s); stepCompanion(w, s, 0); stepBoss(w, s); s.prev = inp; return s; }
    s.t++; s.ticks++;
    updateLights(w, s.t);
    stepSwitches(w, s);
    stepCompanion(w, s, inp);
    stepBoss(w, s);

    if (s.dead) {
      s.deadT++; s.anim++;
      if (s.deadT >= C.DEADT) respawn(s);
      s.prev = inp;
      return s;
    }

    const prev = s.prev;
    const dirIn = ((inp & IN.R) ? 1 : 0) - ((inp & IN.L) ? 1 : 0);
    const jumpPress = (inp & IN.J) && !(prev & IN.J);
    const jumpHeld = !!(inp & IN.J);
    const downPress = (inp & IN.D) && !(prev & IN.D);

    if (jumpPress) s.buf = C.BUFFER; else if (s.buf > 0) s.buf--;
    if (s.rollCD > 0) s.rollCD--;
    if (s.wlock > 0) s.wlock--;
    if (s.grace > 0) s.grace--;

    // ground / wall probes
    if (s.drop > 0) s.drop--;
    let grounded = s.vy >= 0 && (rectSolid(w, s.x, s.y + 0.5, C.W, s.h) || onOneway(w, s));
    // dropping through a shelf: down while standing on one (and not on rock)
    if (grounded && downPress && w.hasOneway && onOneway(w, s) && !rectSolid(w, s.x, s.y + 0.5, C.W, s.h)) {
      s.drop = C.DROP; s.y += 1; grounded = false;
    }
    // vines: hold up to climb, down to slide, sideways to shimmy; no gravity while holding on
    const onVine = w.hasVine && !(s.roll > 0) && inMask(w, w.vine, s);
    if (onVine && !s.climb && ((!grounded && s.vy >= -20) || jumpHeld) && !(s.vineCD > 0)) { s.climb = true; s.ev |= EV.GRAB; }
    if (!onVine || (s.climb && grounded && !jumpHeld)) s.climb = false;
    if (s.vineCD > 0) s.vineCD--;
    if (grounded) { s.coy = C.COYOTE; } else if (s.coy > 0) s.coy--;
    const touchL = rectSolid(w, s.x - 0.6, s.y + 1, C.W, s.h - 2);
    const touchR = rectSolid(w, s.x + 0.6, s.y + 1, C.W, s.h - 2);
    const wasOnG = s.onG;
    s.onG = grounded;

    // ---- rolling
    const rolling = s.roll > 0 || s.crawl;
    if (!rolling && downPress && grounded && s.rollCD === 0 && !s.climb) {
      s.roll = C.ROLLT; s.rollDir = dirIn !== 0 ? dirIn : s.face; s.face = s.rollDir;
      setH(s, C.HR); s.ev |= EV.ROLL; s.anim = 0;
    }
    if (s.roll > 0) {
      s.roll--;
      if (s.roll === 0) {
        s.rollCD = C.ROLLCD;
        if (canStand(w, s)) setH(s, C.H); else s.crawl = true;
      }
    } else if (s.crawl && canStand(w, s)) {
      s.crawl = false; setH(s, C.H);
    }
    const low = s.roll > 0 || s.crawl;

    // ---- horizontal control
    if (low) {
      if (s.roll > 0) {
        const k = s.roll / C.ROLLT;
        const sp = C.CRAWL + (C.ROLLV - C.CRAWL) * Math.min(1, k * 1.6);
        s.vx = s.rollDir * sp;
      } else {
        s.vx = dirIn * C.CRAWL; if (dirIn) s.face = dirIn;
      }
    } else if (s.climb) {
      // hung from the middle of the strand on a soft spring: you swing in a little when you catch it,
      // lean a pixel or two toward where you are pressing, and settle back; you can't slide off sideways
      const cx = Math.floor((s.x + C.W / 2) / TS) * TS + TS / 2 - C.W / 2;
      const tx = cx + dirIn * C.LEAN;
      s.vx += ((tx - s.x) * C.SPRK - s.vx * C.SPRD) * DT;
      if (s.vx > C.SNAPV) s.vx = C.SNAPV; else if (s.vx < -C.SNAPV) s.vx = -C.SNAPV;
      const off = s.x + s.vx * DT - cx;
      if (Math.abs(off) > C.SWAYMAX) { s.x = cx + Math.sign(off) * C.SWAYMAX - s.vx * DT; s.vx *= -0.3; }
      if (dirIn) s.face = dirIn;
    } else if (s.wlock > 0) {
      // keep wall-jump impulse, allow small steering
      s.vx += dirIn * C.AACC * 0.25 * DT;
    } else {
      const target = dirIn * C.RUN;
      let acc = grounded ? (dirIn ? C.GACC : C.GFRIC) : (dirIn ? C.AACC : C.AFRIC);
      if (grounded && w.hasTT && floorType(w, s) === TT.ICE) acc *= dirIn ? C.ICEACC : C.ICEFRIC;
      if (s.vx < target) s.vx = Math.min(target, s.vx + acc * DT);
      else if (s.vx > target) s.vx = Math.max(target, s.vx - acc * DT);
      if (dirIn) s.face = dirIn;
    }

    // ---- wall slide / wall jump
    let wallDir = 0;
    if (!grounded && !low && !s.climb) {
      if (touchL && (dirIn < 0 || s.vy > 0)) wallDir = -1;
      else if (touchR && (dirIn > 0 || s.vy > 0)) wallDir = 1;
      if (touchL && touchR) wallDir = dirIn || -1;
    }
    if (wallDir !== 0) { s.wcoy = C.WCOY; s.wdir = wallDir; } else if (s.wcoy > 0) s.wcoy--;
    s.wallDir = wallDir;

    // ---- jump
    if (s.climb) {
      // leaping off a vine sideways
      if (jumpPress && dirIn !== 0) { s.climb = false; s.vineCD = 18; s.vy = -C.JUMPV * 0.85; s.vx = dirIn * C.RUN; s.buf = 0; s.ev |= EV.JUMP; s.airT = 0; }
      else if (dirIn !== 0 && ledgeBeside(w, s, dirIn)) { s.climb = false; s.vineCD = 18; s.vx = dirIn * C.RUN * 0.7; s.vy = 0; s.buf = 0; }   // step off onto a ledge
      else s.buf = 0;
    }
    if (s.buf > 0) {
      if ((s.coy > 0 || (low && grounded)) && (!low || canStand(w, s) || true)) {
        if (low && !canStand(w, s)) { /* cannot jump out of a low tunnel */ }
        else {
          if (low) { s.roll = 0; s.crawl = false; setH(s, C.H); }
          s.vy = -C.JUMPV; s.buf = 0; s.coy = 0; s.onG = false; s.ev |= EV.JUMP; s.airT = 0;
        }
      } else if (s.wcoy > 0 && !grounded) {
        s.vy = -C.WJY; s.vx = -s.wdir * C.WJX; s.face = -s.wdir; s.wlock = C.WLOCK; s.ajump = true;
        s.buf = 0; s.wcoy = 0; s.ev |= EV.WJUMP;
      }
    }

    // ---- gravity
    if (s.climb) {
      s.vy = jumpHeld ? -C.CLIMBUP : (inp & IN.D) ? C.CLIMBDN : 0;
    } else if (!grounded || s.vy < 0) {
      let g = s.vy < 0 ? C.GU : C.GD;
      if (s.vy < 0 && !jumpHeld) g *= C.CUT;
      if (Math.abs(s.vy) < C.APEXV && jumpHeld) g *= C.APEXG;
      s.vy += g * DT;
      if (wallDir !== 0 && s.vy > C.WSLIDE) s.vy = Math.max(C.WSLIDE, s.vy - 1400 * DT);
      if (s.vy > C.MAXFALL) s.vy = C.MAXFALL;
    }
    // vents blow upward
    if (w.hasVent && !s.climb && inMask(w, w.vent, s)) {
      s.vy -= C.VENTACC * DT; if (s.vy < -C.VENTMAX) s.vy = -C.VENTMAX;
      if (grounded) { s.onG = false; }
    }

    // ---- integrate
    const hitX = moveX(w, s, s.vx * DT);
    if (hitX) s.vx = 0;
    const hy = moveY(w, s, s.vy * DT);
    if (hy === 1) {
      if (w.hasTT && !low && floorType(w, s) === TT.BOUNCE) {
        // a bounce cap throws you up; holding jump goes higher
        s.vy = -C.BOUNCE; s.onG = false; s.coy = 0; s.ev |= EV.BOUNCE; s.airT = 0;
      } else {
        if (!wasOnG && s.vy > 30) { s.ev |= EV.LAND; s.landV = s.vy; if (s.vy > 150) s.ev |= EV.HARDLAND; }
        s.vy = 0; s.onG = true;
      }
    } else if (hy === -1) s.vy = 0;
    else if (s.vy > 0 && s.onG && !rectSolid(w, s.x, s.y + 0.5, C.W, s.h) && !onOneway(w, s)) s.onG = false;

    // ---- animation state
    const prevSt = s.st;
    if (s.face !== s.lastFace) { s.faceT = s.t; s.lastFace = s.face; }
    if (s.onG || wallDir !== 0) s.ajump = false;
    if (low) s.st = 'roll';
    else if (s.climb) s.st = 'climb';
    else if (!s.onG && wallDir !== 0 && s.vy > 0) s.st = 'wall';
    else if (!s.onG) s.st = s.vy < 0 ? 'jump' : 'fall';
    else s.st = Math.abs(s.vx) > 6 && dirIn !== 0 ? 'run' : 'idle';
    if (s.st !== prevSt) {
      // a run broken for a few ticks picks its stride back up instead of restarting (cosmetic only)
      if (prevSt === 'run') { s.runAnim = s.anim; s.runEnd = s.t; }
      s.anim = 0; s.fromSt = prevSt; if (s.st === 'jump') s.airT = 0;
      if (s.st === 'run' && s.runEnd !== undefined && s.t - s.runEnd < 12 && s.fromSt !== 'fall') { s.anim = s.runAnim + (s.t - s.runEnd); s.fromSt = 'run'; }
    }
    else s.anim++;
    if (!s.onG) s.airT++;

    // ---- light & exposure
    s.lit = playerLit(w, s);
    let b = (s.lit - C.LITLO) / (C.LITHI - C.LITLO); b = b < 0 ? 0 : b > 1 ? 1 : b; b = b * b * (3 - 2 * b);
    s.burn = b;
    if (s.grace > 0) { s.ex = Math.max(0, s.ex - C.REGEN * DT); }
    else if (b > 0) s.ex += b * C.BURN * (w.lastBM || 1) * DT - (1 - b) * C.REGEN * DT * 0.35;
    else s.ex -= C.REGEN * DT;
    if (s.ex < 0) s.ex = 0;
    if (s.ex >= 1) { s.ex = 1; killPlayer(s, 'seen'); }
    if (s.y > w.killY) killPlayer(s, 'void');
    else {
      const kx = s.x + C.W / 2, ky = s.y + s.h;
      const ks = w.kills;
      for (let i = 0; i < ks.length; i++) {
        const k = ks[i];
        if (kx > k[0] && kx < k[2] && ky > k[1] && ky < k[3]) { killPlayer(s, 'void'); break; }
      }
    }

    // ---- checkpoints & goal
    const cx = s.x + C.W / 2, cy = s.y + s.h / 2;
    for (let i = 0; i < w.checks.length; i++) {
      const c = w.checks[i];
      if (c.i > s.cp && !(w.boss && c.i === w.boss.mid) && Math.abs(cx - c.x) < 14 && Math.abs(cy - (c.y - 8)) < 14) {
        s.cp = c.i; s.cpX = c.x; s.cpY = c.y; s.ev |= EV.CHECK; s.ex = Math.max(0, s.ex - 0.5);
      }
    }
    const sk = w.secret;
    if (sk && !s.cmp && Math.abs(cx - sk.x) < 10 && Math.abs(cy - sk.y) < 14) {
      s.cmp = 1; s.cmpX = sk.x; s.cmpY = sk.y; s.ev |= EV.SEEKER;
    }
    const g = w.goal;
    if (Math.abs(cx - g.x) < 11 && Math.abs(cy - g.y) < 14) { s.won = true; s.wonT = 0; s.ev |= EV.WIN; }

    s.prev = inp;
    return s;
  }

  global.Dweller = global.Dweller || {};
  Object.assign(global.Dweller, {
    TS, TICK, DT, BEAT, IN, EV, C, smooth,
    makeWorld, newState, cloneState, step, solidAt, rectSolid, castRay, rayClear, TT, ttAt, onOneway,
    lightAt, updateLights, schedGain, playerLit, GB,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Dweller;
})(typeof globalThis !== 'undefined' ? globalThis : this);
