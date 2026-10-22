/* DWELLER — the town above the descent: a hollow village in a dead wood under the mountains.
 * The Dweller walks it with the same body as in the caves (the real simulation runs on a small world built here),
 * and everything else is painted here: the sky, four layers of mountains and forest, the houses and the six doors
 * down (each glows in its sliver's colour once that sliver is found), the great door under the mountain that takes
 * the whole crystal, the signs at the edge of town, the residents, and three quiet secrets. */
(function (global) {
  'use strict';
  const D = global.Dweller, R = global.DwellerRender;
  const TS = D.TS;
  const W = 250, H = 70, G = 40;                  // tiles; G is the ground row
  const GY = G * TS;                              // the ground, in pixels
  const WPX = W * TS, HPX = H * TS;

  /* ------------------------------------------------------------ the shape of the town (tiles) */
  const groundAt = (x) => x < 212 ? G : x < 218 ? G - 1 : x < 224 ? G - 2 : G - 3;
  const WELL = { x0: 90, x1: 94, room: [82, 106, 52, 60] };    // rims at x0 and x1, the shaft between; a room below
  const CLIFF = 244;                                            // solid rock from here to the right edge
  function buildLevel() {
    const solid = new Uint8Array(W * H);
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) solid[y * W + x] = v; };
    for (let x = 0; x < W; x++) for (let y = groundAt(x); y < H; y++) set(x, y, 1);
    for (let x = CLIFF; x < W; x++) for (let y = 0; y < H; y++) set(x, y, 1);
    // the well: two rims of stone, a shaft, and a small room under the town
    set(WELL.x0, G - 1, 1); set(WELL.x0, G - 2, 1); set(WELL.x1, G - 1, 1); set(WELL.x1, G - 2, 1);
    for (let x = WELL.x0 + 1; x < WELL.x1; x++) for (let y = G; y < WELL.room[2] + 2; y++) set(x, y, 0);
    const [rx0, rx1, ry0, ry1] = WELL.room;
    for (let x = rx0; x < rx1; x++) for (let y = ry0; y < ry1; y++) {
      // a rough, rounded room
      const u = (x - (rx0 + rx1) / 2) / ((rx1 - rx0) / 2), v = (y - (ry0 + ry1) / 2) / ((ry1 - ry0) / 2);
      if (u * u * 0.8 + v * v * (y < (ry0 + ry1) / 2 ? 1.1 : 0.2) < 1.02) set(x, y, 0);
    }
    const rows = [];
    for (let y = 0; y < H; y++) {
      const runs = []; let v = 0, n = 0;
      for (let x = 0; x < W; x++) { const s = solid[y * W + x]; if (s === v) n++; else { runs.push(n); v = s; n = 1; } }
      runs.push(n); rows.push(runs);
    }
    return {
      w: W, h: H, rows, checks: [], goal: { x: -99999, y: -99999 }, spawn: { x: 13 * TS, y: GY },
      sections: [{ x0: 0, x1: W, title: '', music: { e: 0.12, root: 0 } }], hints: [], lights: [],
      vines: [[92, G - 3, 1, ry1 - G + 3]], theme: 'descent',
    };
  }

  /* the six doors down, the great door, the residents, the signs */
  const DOORS = [
    { i: 0, x: 44 * TS, kind: 'house' },
    { i: 1, x: 72 * TS, kind: 'tree' },
    { i: 2, x: 112 * TS, kind: 'glass' },
    { i: 3, x: 148 * TS, kind: 'forge' },
    { i: 4, x: 168 * TS, kind: 'ember' },
    { i: 5, x: 187 * TS, kind: 'heart' },
  ];
  const GREAT = { x: 234 * TS, y: (G - 3) * TS };
  const WELLX = 92 * TS + 3, RAREX = 99 * TS, RAREY = WELL.room[3] * TS;
  const RES = [
    { id: 'collector', x: 99 * TS, face: -1 },
    { id: 'exiled', x: 132 * TS, face: 1 },
    { id: 'monk', x: 202 * TS, face: 1 },
    { id: 'weaver', x: 158 * TS, face: 1 },
  ];
  const SIGNS = [
    { x: 9 * TS, lines: () => [['A D', 'MOVE'], ['SPACE', 'JUMP'], ['S', 'ROLL']], touch: () => [['< >', 'MOVE'], ['JUMP', ''], ['ROLL', '']] },
    { x: 31 * TS, lines: () => [['HOLD S', 'CRAWL'], ['E', 'ENTER'], ['E', 'SEEKER']], touch: () => [['HOLD ROLL', 'CRAWL'], ['ENTER', 'DOORS'], ['SEEK', 'SEEKER']] },
  ];
  const TINY = [['ESC  TITLE', 'M  MUTE', 'F  FULLSCREEN']];

  /* ------------------------------------------------------------ painting helpers */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function rect(x, c, X, Y, w, h) { x.fillStyle = c; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); }
  function line(x, c, x0, y0, x1, y1, wd) {
    x.fillStyle = c; wd = wd || 1;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) { const u = i / n; x.fillRect(Math.round(x0 + (x1 - x0) * u - wd / 2), Math.round(y0 + (y1 - y0) * u - wd / 2), Math.max(1, Math.round(wd)), Math.max(1, Math.round(wd))); }
  }
  function disc(x, c, X, Y, r) { x.fillStyle = c; for (let j = -r; j <= r; j++) { const h = Math.floor(Math.sqrt(r * r - j * j)); x.fillRect(Math.round(X - h), Math.round(Y + j), h * 2 + 1, 1); } }
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { const c = rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function glow(x, X, Y, r, hex, a) {
    const g = x.createRadialGradient(X, Y, 0, X, Y, r);
    g.addColorStop(0, rgba(hex, a)); g.addColorStop(1, rgba(hex, 0));
    x.fillStyle = g; x.fillRect(X - r, Y - r, r * 2, r * 2);
  }
  const PALT = {
    sky0: '#06070c', sky1: '#0f131d', sky2: '#1b2230',
    m0: '#283041', m0s: '#3a4456', m0h: '#323b4d', m1: '#1a202c', m1h: '#222a38', f0: '#121721', f1: '#0d1118',
    earth: '#10131a', earth2: '#0b0d12', topsoil: '#1d222c', frost: '#38414f', grass: '#232a33',
    rock: '#0e1016', rock2: '#141720', rock3: '#191d27', cave: '#07080c',
    wood0: '#1f1915', wood1: '#322821', wood2: '#43372d', woodH: '#56473a',
    st0: '#1a1d25', st1: '#272b35', st2: '#333945', st3: '#434a57',
    roof0: '#171a22', roof1: '#22262f', roof2: '#2d323e',
    thorn: '#0c100e', thorn2: '#16201b', thornT: '#2a3a31',
    win: '#9fd2c6', moon: '#cfd8e2',
  };

  /* ------------------------------------------------------------ far layers (parallax) */
  const LAYERS = [];
  function ridge(r, n, base, amp, rough) {
    // a jagged ridge: sum of a few octaves, sharpened
    const h = new Float32Array(n);
    const oct = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]].map((_, k) => ({ f: (0.004 + r() * 0.002) * Math.pow(2.3, k), p: r() * 100, a: Math.pow(rough, k) }));
    for (let i = 0; i < n; i++) {
      let v = 0, t = 0;
      for (const o of oct) { v += (1 - Math.abs(Math.sin(i * o.f + o.p))) * o.a; t += o.a; }
      h[i] = base - amp * Math.pow(v / t, 1.6);
    }
    return h;
  }
  function buildLayers() {
    LAYERS.length = 0;
    const r = rng(7);
    const span = (p) => Math.ceil(WPX * p + 1000);
    // the great range, far away and pale; one peak towers over the far end of the town (above the great door)
    {
      const p = 0.07, n = span(p), [c, x] = canvas(n, 260);
      const h = ridge(r, n, 205, 120, 0.55);
      const peakX = GREAT.x * p + 120;
      for (let i = 0; i < n; i++) { const d = (i - peakX) / 110; h[i] = Math.min(h[i], 214 - 170 * Math.exp(-d * d) - Math.abs(Math.sin(i * 0.21)) * 4); }
      for (let i = 0; i < n; i++) {
        const y = Math.round(h[i]), sl = h[Math.min(n - 1, i + 1)] - h[i];
        rect(x, PALT.m0, i, y, 1, 260 - y);
        if (sl > 0.15) rect(x, PALT.m0h, i, y, 1, Math.min(14, 260 - y));                     // the moonward faces
        const snow = 120 + Math.sin(i * 0.05) * 10;
        if (y < snow) rect(x, PALT.m0s, i, y, 1, Math.max(1, Math.min(snow - y, 3 + (sl > 0 ? 5 : 1))));
      }
      LAYERS.push({ p, c, y0: 0 });
    }
    // a nearer, darker range
    {
      const p = 0.16, n = span(p), [c, x] = canvas(n, 260);
      const h = ridge(r, n, 228, 90, 0.6);
      for (let i = 0; i < n; i++) {
        const y = Math.round(h[i]), sl = h[Math.min(n - 1, i + 1)] - h[i];
        rect(x, PALT.m1, i, y, 1, 260 - y);
        if (sl > 0.3) rect(x, PALT.m1h, i, y, 1, 3);
      }
      LAYERS.push({ p, c, y0: 0, fog: true });
    }
    // the far wood: pines and bare crowns in a band
    {
      const p = 0.34, n = span(p), [c, x] = canvas(n, 260);
      rect(x, PALT.f0, 0, 214, n, 46);
      for (let i = 0; i < n; i += 3 + Math.floor(r() * 4)) {
        const th = 18 + r() * 26, y0 = 216;
        if (r() < 0.7) for (let j = 0; j < th; j++) { const w = Math.round((j / th) * (4 + th * 0.18)); rect(x, PALT.f0, i - w, y0 - th + j, w * 2 + 1, 1); }
        else { line(x, PALT.f0, i, y0, i + (r() - 0.5) * 4, y0 - th, 1); for (let k = 0; k < 4; k++) { const yy = y0 - th * (0.4 + r() * 0.6); line(x, PALT.f0, i, yy, i + (r() - 0.5) * 14, yy - 4 - r() * 6, 1); } }
      }
      LAYERS.push({ p, c, y0: 0, fog: true });
    }
    // the near wood behind the houses: tall bare trunks
    {
      const p = 0.62, n = span(p), [c, x] = canvas(n, 260);
      rect(x, PALT.f1, 0, 228, n, 32);
      for (let i = 0; i < n; i += 14 + Math.floor(r() * 22)) {
        const th = 60 + r() * 70, lean = (r() - 0.5) * 10;
        deadTree(x, r, i, 232, th, lean, PALT.f1, 2 + Math.round(r()));
      }
      LAYERS.push({ p, c, y0: 0, eyes: true });
    }
  }
  /* a dead tree: a trunk and a few crooked branches that fork once or twice */
  function deadTree(x, r, X, Y, th, lean, col, wd) {
    const tx = X + lean, ty = Y - th;
    line(x, col, X, Y, tx, ty, wd + 1);
    line(x, col, X - 1, Y, X + 1, Y - th * 0.3, wd + 2);
    const br = (x0, y0, a, len, w, depth) => {
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      line(x, col, x0, y0, x1, y1, w);
      if (depth > 0) { br(x1, y1, a - 0.4 - r() * 0.4, len * 0.65, Math.max(1, w - 1), depth - 1); if (r() < 0.8) br(x1, y1, a + 0.3 + r() * 0.4, len * 0.6, Math.max(1, w - 1), depth - 1); }
    };
    for (let k = 0; k < 4; k++) {
      const u = 0.35 + k * 0.17 + r() * 0.08;
      const bx = X + lean * u, by = Y - th * u, side = k % 2 ? 1 : -1;
      br(bx, by, -Math.PI / 2 + side * (0.6 + r() * 0.5), th * (0.18 + r() * 0.12), Math.max(1, wd - 1), 2);
    }
    br(tx, ty, -Math.PI / 2 + (r() - 0.5) * 0.6, th * 0.15, 1, 2);
  }

  /* ------------------------------------------------------------ the town itself, painted once */
  let WC = null, wx = null;              // the world canvas
  let FRONT = null;                      // the silhouettes in front of everything
  function buildWorld() {
    [WC, wx] = canvas(WPX, HPX);
    const r = rng(11);
    const x = wx;
    // underground rock and the hidden room
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const s = D.solidAt(TW, tx, ty);
      const under = ty >= groundAt(tx);
      if (s && ty >= groundAt(tx) + 1) {
        rect(x, PALT.rock, tx * TS, ty * TS, TS, TS);
        if (r() < 0.18) rect(x, PALT.rock2, tx * TS + Math.floor(r() * 4), ty * TS + Math.floor(r() * 4), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
      } else if (!s && under) rect(x, PALT.cave, tx * TS, ty * TS, TS, TS);
    }
    // the edges of the hidden room and the shaft catch a little light
    for (let ty = G; ty < H; ty++) for (let tx = 1; tx < W - 1; tx++) {
      if (!D.solidAt(TW, tx, ty)) continue;
      if (!D.solidAt(TW, tx, ty - 1) && ty - 1 >= G) { rect(x, PALT.rock3, tx * TS, ty * TS, TS, 2); if (r() < 0.4) rect(x, '#24323a', tx * TS + Math.floor(r() * 5), ty * TS - 1, 1, 1); }
      if (!D.solidAt(TW, tx + 1, ty) && ty >= G) rect(x, PALT.rock2, tx * TS + TS - 1, ty * TS, 1, TS);
      if (!D.solidAt(TW, tx - 1, ty) && ty >= G) rect(x, PALT.rock2, tx * TS, ty * TS, 1, TS);
    }
    // the earth: a band of soil under a frosted, grassy top
    for (let tx = 0; tx < CLIFF; tx++) {
      const gy = groundAt(tx) * TS;
      if (tx > WELL.x0 && tx < WELL.x1) continue;
      rect(x, PALT.earth, tx * TS, gy, TS, TS + 2);
      for (let i = 0; i < TS; i++) {
        const X = tx * TS + i, k = r();
        rect(x, PALT.topsoil, X, gy, 1, 2 + (k < 0.3 ? 1 : 0));
        if (k < 0.55) rect(x, PALT.frost, X, gy, 1, 1);
        if (k > 0.86) rect(x, PALT.grass, X, gy - 1 - Math.floor(r() * 3), 1, 2 + Math.floor(r() * 2));
        if (k > 0.97) rect(x, '#2b313b', X, gy + 3 + Math.floor(r() * 3), 2, 1);
      }
      // a step's face
      if (groundAt(tx - 1) > groundAt(tx)) rect(x, PALT.st1, tx * TS, gy, 1, (groundAt(tx - 1) - groundAt(tx)) * TS + 2);
    }
    // the trodden road through town: a slightly paler, stonier strip
    for (let X = 40; X < 212 * TS; X++) { if (X > WELL.x0 * TS && X < (WELL.x1 + 1) * TS) continue; if (r() < 0.25) rect(x, '#272c36', X, GY + 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2), 1); }
    // the cliff at the end of town, and the mountain's foot behind the great door
    mountainFoot(x, r);
    for (let tx = CLIFF; tx < W; tx++) for (let ty = 0; ty < H; ty++) {
      rect(x, '#13161c', tx * TS, ty * TS, TS, TS);
      if (r() < 0.3) rect(x, r() < 0.5 ? PALT.st0 : PALT.st1, tx * TS + Math.floor(r() * 4), ty * TS + Math.floor(r() * 4), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
    }
    for (let ty = 0; ty < G; ty++) rect(x, PALT.st2, CLIFF * TS, ty * TS + Math.floor(r() * 3), 1, 4 + Math.floor(r() * 3));

    // behind-the-houses dead trees, in the world itself
    for (const [tx, th, lean] of [[2, 120, 6], [10, 96, -8], [58, 110, 4], [84, 90, -6], [122, 130, 8], [140, 84, -4], [160, 104, 6], [178, 92, -10], [196, 118, 5], [214, 86, -6]]) deadTree(x, r, tx * TS, GY + 1, th, lean, '#0b0e13', 3);

    // the houses and the six doors (the glows are drawn live)
    drawHouse(x, r, 44 * TS, GY, 'door');
    drawHollowTree(x, r, 72 * TS, GY);
    drawGlassArch(x, r, 112 * TS, GY);
    drawHouse(x, r, 126 * TS, GY, 'plain');
    drawForge(x, r, 148 * TS, GY);
    drawEmberHut(x, r, 168 * TS, GY);
    drawThornArch(x, r, 187 * TS, GY);
    drawWell(x, r);
    drawShrineStones(x, r);
    // fences, stones, lamp posts, brambles
    for (const [a, b] of [[52, 60], [118, 123], [154, 160], [205, 211]]) fence(x, r, a * TS, b * TS, GY);
    for (const tx of [30, 64, 104, 140, 176]) lampPost(x, tx * TS, GY);
    for (const [tx, n] of [[0, 9], [26, 3], [60, 2], [82, 3], [108, 2], [137, 3], [178, 3], [195, 2], [226, 4]]) bramble(x, r, tx * TS, GY, n);
    for (const tx of [16, 54, 100, 157, 192]) { const X = tx * TS + 2; rect(x, PALT.st1, X, GY - 4, 5, 4); rect(x, PALT.st2, X + 1, GY - 5, 3, 1); rect(x, PALT.st3, X + 1, GY - 4, 1, 1); }
    // the signs at the edge of town (the words are drawn live, so they follow the controls in use)
    for (const s of SIGNS) signPost(x, s.x, GY);
    // the front: thorns and trunks between you and the viewer, darker than everything
    buildFront();
  }
  function mountainFoot(x, r) {
    // the root of the mountain: a slope of dark rock rising behind the last stretch of town, the great door cut into it
    const x0 = 210 * TS, x1 = CLIFF * TS;
    for (let X = x0; X < x1; X++) {
      const u = (X - x0) / (x1 - x0);
      const top = Math.round(GY - 30 - u * 150 - Math.abs(Math.sin(X * 0.13)) * 5 - Math.abs(Math.sin(X * 0.031)) * 10);
      rect(x, PALT.st0, X, top, 1, groundAt(Math.floor(X / TS)) * TS - top);
      if (Math.sin(X * 0.13) > 0.6) rect(x, PALT.st1, X, top, 1, 3);
    }
    // the great door: a tall arch of fitted stone with a ring of six sockets around a seventh
    const cx = GREAT.x, by = GREAT.y, w = 22, h = 50;
    for (let j = 0; j < h + 10; j++) {
      const y = by - j, half = j < h - 14 ? w + 6 : Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((j - (h - 14)) / 24, 2))) * (w + 6));
      rect(x, PALT.st2, cx - half, y, half * 2, 1);
    }
    for (let j = 0; j < h; j++) {
      const y = by - j, half = j < h - 14 ? w : Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((j - (h - 14)) / 16, 2))) * w);
      rect(x, '#08090d', cx - half, y, half * 2, 1);
    }
    // the stones of the frame
    for (let j = 0; j < h; j += 7) { rect(x, PALT.st3, cx - w - 6, by - j - 1, 6, 1); rect(x, PALT.st1, cx + w, by - j - 1, 6, 1); }
    rect(x, PALT.st3, cx - w - 8, by - 2, w * 2 + 16, 2);
    // the two leaves of the door (drawn shut; when it opens they are covered by the light)
    rect(x, '#15171d', cx - w + 2, by - h + 16, w - 3, h - 16); rect(x, '#121419', cx + 1, by - h + 16, w - 3, h - 16);
    for (let j = 0; j < h - 16; j += 6) { rect(x, '#1c1f27', cx - w + 3, by - j - 3, w - 5, 1); rect(x, '#181a21', cx + 2, by - j - 3, w - 5, 1); }
  }
  function drawHouse(x, r, cx, by, kind) {
    const w = kind === 'door' ? 38 : 44, h = kind === 'door' ? 34 : 38;
    const x0 = cx - w / 2;
    // stone foot, crooked timber walls, slate roof that sags
    rect(x, PALT.st1, x0 - 1, by - 5, w + 2, 5);
    rect(x, PALT.wood1, x0, by - h, w, h - 5);
    for (let X = x0 + 2; X < x0 + w; X += 4) rect(x, PALT.wood0, X, by - h, 1, h - 5);
    rect(x, PALT.woodH, x0, by - h, 1, h - 5);
    const peak = by - h - 20;
    for (let j = 0; j < 22; j++) {
      const y = peak + j, half = Math.round(j * (w / 2 + 6) / 22) + (j > 18 ? 1 : 0);
      const sag = Math.round(Math.sin((j / 22) * Math.PI) * 1.5);
      rect(x, j % 3 === 0 ? PALT.roof2 : PALT.roof1, cx - half + sag, y, half * 2, 1);
      rect(x, '#343a46', cx - half + sag, y, 1, 1);
    }
    rect(x, PALT.roof0, cx - w / 2 - 6, by - h + 1, w + 12, 2);
    // chimney
    rect(x, PALT.st1, cx + w / 4, peak + 3, 5, 12); rect(x, PALT.st2, cx + w / 4 - 1, peak + 2, 7, 2);
    // windows: shuttered, a little cold light leaks out
    const wins = kind === 'door' ? [[x0 + 5, by - 24]] : [[x0 + 6, by - 26], [x0 + w - 14, by - 26], [cx - 3, peak + 12]];
    for (const [X, Y] of wins) { rect(x, '#0b0e10', X, Y, 8, 8); rect(x, '#21302d', X + 1, Y + 1, 6, 6); rect(x, PALT.wood0, X + 3, Y, 2, 8); rect(x, PALT.wood0, X, Y + 3, 8, 2); rect(x, PALT.wood2, X - 1, Y + 8, 10, 1); }
    if (kind === 'door') {
      // the door: planks in a frame, under a little lintel
      const dx = cx + 2, dw = 12, dh = 20;
      rect(x, PALT.wood2, dx - 1, by - dh - 2, dw + 2, dh + 2);
      rect(x, '#07080b', dx, by - dh, dw, dh);
      rect(x, PALT.woodH, dx - 2, by - dh - 3, dw + 4, 1);
    }
  }
  function drawHollowTree(x, r, cx, by) {
    // a giant dead tree, hollow at the foot, with pale mushrooms on its roots
    const tw = 30;
    for (let j = 0; j < 150; j++) {
      const y = by - j, half = Math.round(tw / 2 + Math.max(0, 14 - j) * 0.9 - j * 0.04 + Math.sin(j * 0.2) * 1.2);
      rect(x, '#161310', cx - half, y, half * 2, 1);
      rect(x, '#241e19', cx - half, y, 2, 1);
      if (j % 9 === 0) rect(x, '#1e1915', cx - half + 4 + (j % 5), y, 2, 3);
    }
    deadTree(x, r, cx, by - 140, 70, 4, '#161310', 3);
    // the hollow
    const hw = 9, hh = 24;
    for (let j = 0; j < hh; j++) { const half = j > hh - 9 ? Math.round(Math.sqrt(1 - Math.pow((j - (hh - 9)) / 9, 2)) * hw) : hw; rect(x, '#07080b', cx - half, by - j - 1, half * 2, 1); }
    // roots
    for (const [dx, len] of [[-16, 14], [-12, 8], [14, 12], [10, 6]]) line(x, '#161310', cx + dx, by - 2, cx + dx + Math.sign(dx) * len, by, 3);
    // mushrooms
    for (const [dx, h] of [[-19, 4], [-15, 2], [17, 3], [21, 5], [-6, 2]]) { rect(x, '#5c6b70', cx + dx, by - h, 1, h); rect(x, '#8fa6a6', cx + dx - 1, by - h - 1, 3, 1); rect(x, '#b7c9c4', cx + dx, by - h - 2, 1, 1); }
  }
  function drawGlassArch(x, r, cx, by) {
    // a ring of ice and glass shards standing in the grass
    const R0 = 15, R1 = 22;
    for (let a = 0; a <= Math.PI; a += 0.025) {
      const c = Math.cos(a), s = Math.sin(a);
      for (let q = R0; q <= R1; q++) {
        const X = cx + c * q, Y = by - 10 - s * q * 1.2;
        const k = (Math.floor(a * 14) + q) % 4;
        rect(x, k === 0 ? '#4c6273' : k === 1 ? '#2f3f4c' : '#3a4d5c', X, Y, 1, 1);
      }
    }
    for (let j = 0; j < 10; j++) { rect(x, '#2f3f4c', cx - R1, by - j, R1 - R0 + 1, 1); rect(x, '#3a4d5c', cx + R0, by - j, R1 - R0 + 1, 1); }
    // jutting crystals
    for (const [a, l] of [[0.3, 9], [0.8, 12], [1.4, 10], [2.0, 13], [2.6, 8], [3.0, 7]]) {
      const X = cx + Math.cos(a) * R1, Y = by - 10 - Math.sin(a) * R1 * 1.2;
      line(x, '#6f8fa3', X, Y, X + Math.cos(a) * l * 0.6, Y - Math.sin(a) * l, 2);
      line(x, '#a9c9d6', X, Y, X + Math.cos(a) * l * 0.6, Y - Math.sin(a) * l, 1);
    }
    // the dark inside
    for (let a = 0; a <= Math.PI; a += 0.02) for (let q = 0; q < R0; q++) rect(x, '#07080b', cx + Math.cos(a) * q, by - 10 - Math.sin(a) * q * 1.2, 1, 1);
    rect(x, '#07080b', cx - R0 + 1, by - 10, R0 * 2 - 1, 10);
  }
  function drawForge(x, r, cx, by) {
    // a low stone workshop with a tall chimney and iron-banded doors
    const w = 46, h = 30, x0 = cx - w / 2;
    for (let j = 0; j < h; j++) for (let X = x0; X < x0 + w; X += 6) { const off = (Math.floor(j / 4) % 2) * 3; rect(x, ((X + off) / 6 + Math.floor(j / 4)) % 3 ? PALT.st1 : PALT.st2, X + off, by - j - 1, 6, 1); }
    for (let j = 0; j < h; j += 4) rect(x, PALT.st0, x0, by - j - 1, w, 1);
    // flat roof with a lip
    rect(x, PALT.roof1, x0 - 4, by - h - 4, w + 8, 4); rect(x, PALT.roof2, x0 - 4, by - h - 4, w + 8, 1);
    // chimney
    rect(x, PALT.st1, x0 + 6, by - h - 40, 9, 36); rect(x, PALT.st2, x0 + 5, by - h - 42, 11, 3);
    for (let j = 0; j < 36; j += 5) rect(x, PALT.st0, x0 + 6, by - h - 40 + j, 9, 1);
    // anvil by the wall
    rect(x, '#20232a', x0 + w + 3, by - 6, 9, 3); rect(x, '#20232a', x0 + w + 5, by - 3, 5, 3); rect(x, '#3a3f49', x0 + w + 3, by - 6, 9, 1);
    // door with iron bands
    const dw = 16, dh = 20, dx = cx + 2 - dw / 2;
    rect(x, '#2b2f37', dx - 2, by - dh - 2, dw + 4, dh + 2);
    rect(x, '#07080b', dx, by - dh, dw, dh);
    rect(x, '#3a3f49', dx - 2, by - dh - 3, dw + 4, 1);
  }
  function drawEmberHut(x, r, cx, by) {
    // a round, half-sunk hut of black stone; its doorway is a low arch
    const R0 = 22;
    for (let j = 0; j <= R0; j++) {
      const half = Math.round(Math.sqrt(R0 * R0 - j * j) * 1.15);
      rect(x, j % 4 === 0 ? '#1d1a1c' : '#161416', cx - half, by - j - 1, half * 2, 1);
      rect(x, '#2a2426', cx - half, by - j - 1, 2, 1);
    }
    rect(x, '#2a2426', cx - 4, by - R0 - 4, 8, 4);
    for (let k = 0; k < 9; k++) { const a = Math.PI * (k + 0.5) / 9; rect(x, '#221e20', cx + Math.cos(a) * R0 * 1.05, by - Math.sin(a) * R0 * 0.9 - 2, 3, 2); }
    // doorway
    const hw = 8, hh = 17;
    for (let j = 0; j < hh; j++) { const half = j > hh - 8 ? Math.round(Math.sqrt(1 - Math.pow((j - (hh - 8)) / 8, 2)) * hw) : hw; rect(x, '#07080b', cx - half, by - j - 1, half * 2, 1); }
    // a ring of stones on the ground before it
    for (const dx of [-26, -20, 20, 26]) { rect(x, '#1f1c1e', cx + dx - 2, by - 3, 4, 3); rect(x, '#2c2729', cx + dx - 1, by - 3, 2, 1); }
  }
  function drawThornArch(x, r, cx, by) {
    // an arch of black roots grown together and covered in thorns
    const R0 = 13, R1 = 19;
    const strands = 5;
    for (let s = 0; s < strands; s++) {
      const q = R0 + (R1 - R0) * s / (strands - 1);
      let px = cx - q, py = by;
      for (let a = 0; a <= Math.PI; a += 0.03) {
        const wob = Math.sin(a * 9 + s * 2) * 1.5;
        const X = cx - Math.cos(a) * (q + wob), Y = by - 6 - Math.sin(a) * (q + wob) * 1.45;
        line(x, s % 2 ? '#141815' : '#1b221d', px, py, X, Y, 2);
        px = X; py = Y;
      }
      line(x, '#141815', px, py, cx + q, by, 2);
    }
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI, q = R1 + 1, X = cx - Math.cos(a) * q, Y = by - 6 - Math.sin(a) * q * 1.45;
      line(x, PALT.thornT, X, Y, X - Math.cos(a) * (2 + r() * 3), Y - Math.sin(a) * (2 + r() * 3), 1);
    }
    // the dark inside
    for (let a = 0; a <= Math.PI; a += 0.02) for (let q = 0; q < R0 - 1; q++) rect(x, '#07080b', cx - Math.cos(a) * q, by - 6 - Math.sin(a) * q * 1.45, 1, 1);
    rect(x, '#07080b', cx - R0 + 2, by - 6, R0 * 2 - 3, 6);
  }
  function drawWell(x, r) {
    // stone rims (they are solid: hop in), a little roof on two posts, a rope that goes down further than it should
    const x0 = WELL.x0 * TS, x1 = WELL.x1 * TS;
    for (const X of [x0, x1]) { rect(x, PALT.st2, X, GY - 12, TS, 12); rect(x, PALT.st3, X, GY - 12, TS, 1); rect(x, PALT.st1, X, GY - 6, TS, 1); }
    rect(x, PALT.wood1, x0 + 1, GY - 34, 2, 22); rect(x, PALT.wood1, x1 + 3, GY - 34, 2, 22);
    for (let j = 0; j < 7; j++) rect(x, j % 2 ? PALT.roof1 : PALT.roof2, x0 - 4 + j, GY - 40 + j, x1 - x0 + 14 - j * 2, 1);
    rect(x, PALT.wood2, x0 + 2, GY - 31, x1 - x0 + 2, 2);
    // the rope hangs only inside, below the brick cap (which is drawn live, and lifts away once you are in)
    for (let y = GY - 10; y < WELL.room[3] * TS - 2; y += 2) rect(x, y % 6 ? '#4a3f33' : '#3a3129', 92 * TS + 2, y, 1, 2);
    // the shaft: dark, with the stones of its sides
    for (let y = GY; y < WELL.room[2] * TS; y += 4) { rect(x, '#11141a', x0 + TS, y, 1, 3); rect(x, '#11141a', x1 - 1, y + 2, 1, 3); }
  }
  function drawShrineStones(x, r) {
    // a few standing stones around the silent one
    for (const [dx, h] of [[-30, 14], [-24, 9]]) { const X = RES[2].x + dx; rect(x, PALT.st1, X, GY - h, 5, h); rect(x, PALT.st2, X, GY - h, 5, 1); rect(x, PALT.st0, X + 4, GY - h, 1, h); }
  }
  function fence(x, r, a, b, by) {
    for (let X = a; X <= b; X += 7) { const h = 9 + Math.floor(r() * 3), lean = Math.round((r() - 0.5) * 2); line(x, PALT.wood1, X, by, X + lean, by - h, 2); rect(x, PALT.woodH, X + lean, by - h, 1, 1); }
    line(x, PALT.wood0, a, by - 6, b, by - 5, 1); line(x, PALT.wood0, a, by - 3, b, by - 3, 1);
  }
  function lampPost(x, X, by) {
    // an iron post with a shuttered lantern: kept dark, mostly
    rect(x, '#1d2027', X, by - 26, 2, 26); rect(x, '#1d2027', X - 1, by - 2, 4, 2);
    rect(x, '#1d2027', X - 4, by - 27, 7, 1); rect(x, '#1d2027', X - 4, by - 27, 1, 3);
    rect(x, '#20252c', X - 6, by - 24, 5, 6); rect(x, '#2f363f', X - 6, by - 24, 5, 1); rect(x, '#10221f', X - 5, by - 22, 3, 3);
  }
  function bramble(x, r, X0, by, n) {
    for (let k = 0; k < n * 4; k++) {
      const X = X0 + r() * n * 10, h = 6 + r() * 14;
      let px = X, py = by;
      const segs = 4 + Math.floor(r() * 4);
      for (let s = 0; s < segs; s++) {
        const nx = px + (r() - 0.5) * 8, ny = py - h / segs - r() * 2;
        line(x, s % 2 ? PALT.thorn2 : PALT.thorn, px, py, nx, ny, 1);
        if (r() < 0.7) { const d = r() < 0.5 ? -1 : 1; rect(x, PALT.thornT, nx + d, ny, 1, 1); rect(x, PALT.thornT, nx + d * 2, ny - 1, 1, 1); }
        px = nx; py = ny;
      }
    }
  }
  const POST = 24;
  function signPost(x, X, by) {
    // just the post: the boards are sized to their words, which are drawn at half size, so they go on live
    rect(x, PALT.wood1, X - 1, by - POST, 2, POST); rect(x, PALT.woodH, X - 1, by - POST, 1, POST);
    rect(x, PALT.wood2, X - 2, by - POST - 1, 4, 1);
  }
  function buildFront() {
    const p = 1.22, n = Math.ceil(WPX * p + 1000);
    const [c, x] = canvas(n, HPX);
    const r = rng(23);
    for (let X = 0; X < n; X += 90 + Math.floor(r() * 160)) {
      { // a bush of thorns at the bottom edge
        for (let k = 0; k < 14; k++) {
          let px = X + r() * 40, py = GY + 46;
          for (let s = 0; s < 5; s++) { const nx = px + (r() - 0.5) * 10, ny = py - 5 - r() * 6; line(x, '#030405', px, py, nx, ny, 2); if (r() < 0.6) rect(x, '#0a0d0c', nx + 2, ny, 2, 1); px = nx; py = ny; }
        }
      }
    }
    FRONT = { p, c };
  }

  /* ------------------------------------------------------------ residents */
  const RSHEET = {};
  function npcSheets() {
    for (const n of ['collector', 'exiled', 'monk', 'weaver']) {
      const im = R.IMG[n]; if (!im || RSHEET[n]) continue;
      // the night takes the warmth out of them a little
      const [c, x] = canvas(im.width, im.height);
      x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = n === 'monk' ? 'rgba(10,14,26,0.45)' : 'rgba(10,14,26,0.2)'; x.fillRect(0, 0, c.width, c.height);
      RSHEET[n] = { cv: c, cols: 24, rows: 1, w: 48, h: 48, ax: 24, ay: 30, n: 24 };
    }
  }

  /* ------------------------------------------------------------ live state */
  let TW = null;            // the sim world
  let built = false;
  const motes = [], snow = [];
  function build() {
    if (built) return TW;
    TW = D.makeWorld(buildLevel());
    TW.town = true;
    buildLayers(); buildWorld(); npcSheets();
    const r = rng(5);
    for (let i = 0; i < 26; i++) motes.push({ x: r() * WPX, y: GY - 6 - r() * 40, ph: r() * 6.28, sp: 0.3 + r() * 0.6 });
    for (let i = 0; i < 70; i++) snow.push({ x: r(), y: r(), v: 4 + r() * 8, d: r() * 6.28, z: 0.6 + r() * 0.8 });
    built = true;
    return TW;
  }

  /* the sky: fixed to the screen, with a hazy moon */
  let skyC = null, skyH = 0;
  function sky(ctx, LW, LH, time) {
    if (!skyC || skyH !== LH) {
      skyH = LH; const [c, x] = canvas(1, LH);
      const g = x.createLinearGradient(0, 0, 0, LH);
      g.addColorStop(0, PALT.sky0); g.addColorStop(0.55, PALT.sky1); g.addColorStop(1, PALT.sky2);
      x.fillStyle = g; x.fillRect(0, 0, 1, LH); skyC = c;
    }
    ctx.drawImage(skyC, 0, 0, 1, LH, 0, 0, LW, LH);
    // stars, thin and few, and slow to twinkle
    const r = rng(3);
    for (let i = 0; i < 60; i++) {
      const X = Math.floor(r() * LW), Y = Math.floor(r() * LH * 0.5), tw = 0.35 + 0.35 * Math.sin(time * (0.4 + r()) + i);
      ctx.globalAlpha = tw * (1 - Y / (LH * 0.5)); ctx.fillStyle = '#c8d2e0'; ctx.fillRect(X, Y, 1, 1);
    }
    ctx.globalAlpha = 1;
    // the moon, small and pale behind a veil
    const mx = Math.round(LW * 0.78), my = Math.round(LH * 0.14);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, mx, my, 46, '#8894aa', 0.10);
    ctx.globalCompositeOperation = 'source-over';
    disc(ctx, '#aeb8c6', mx, my, 6); disc(ctx, '#c9d2dc', mx - 1, my - 1, 4);
    ctx.fillStyle = '#9ca6b5'; ctx.fillRect(mx + 1, my - 2, 2, 1); ctx.fillRect(mx - 2, my + 1, 1, 1);
  }

  /* the watching eyes in the near wood: only there when you stand perfectly still, and they blink */
  // one face only, deep in the wood behind the first half of town
  // one face only. It drifts with you through the wood unseen; when it shows, it settles near you and stays put
  const FACE = { ex: null, ey: 158 };
  function drawEyes(ctx, L, camX, dy, LW, still, time, px) {
    const k = Math.max(0, Math.min(1, (still - 6) / 2));
    if (k <= 0) { FACE.ex = null; return; }
    const orb = R.IMG.g255_orb, eyes = R.IMG.g255_eyes, body = R.IMG.g255_body;
    if (FACE.ex === null) {
      // a little to one side of the Dweller, toward the middle of the view so the whole face is on screen
      const X = Math.max(34, Math.min(LW - 34, px + (px < LW / 2 ? 1 : -1) * (60 + Math.random() * 40)));
      FACE.ex = X + camX * L.p;
    }
    for (const [ex, ey] of [[FACE.ex, FACE.ey]]) {
      const X = Math.round(ex - camX * L.p), Y = Math.round(ey + dy);
      if (X < -40 || X > LW + 40) continue;
      const cyc = (time + ex * 0.01) % 4.2, shut = cyc < 0.14 || (cyc > 0.4 && cyc < 0.5);
      // the Guardian's own face, half hidden among the trunks: its dark orb, a ghost of its shields, its two crescents
      ctx.globalAlpha = k * 0.14; if (body) ctx.drawImage(body, X - 27, Y - 27);
      ctx.globalAlpha = k * 0.7; if (orb) ctx.drawImage(orb, X - 27, Y - 27);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, X - 5, Y, 16, '#dfe8f0', 0.10 * k);
      ctx.globalCompositeOperation = 'source-over';
      // it glances toward the Dweller
      const look = Math.max(-2, Math.min(2, Math.round((px - X) / 60)));
      ctx.globalAlpha = k * 0.8;
      if (eyes) {
        if (shut) ctx.drawImage(eyes, 18, 27, 8, 1, X - 9 + look, Y, 8, 1);       // a thin line while it blinks
        else ctx.drawImage(eyes, X - 27 + look, Y - 27);
      }
      ctx.globalAlpha = 1;
    }
  }
  /* everything, back to front. st: { s, camX, camY, LW, LH, time, dt, P, near, still, fuse, rare } */
  function draw(ctx, st) {
    const { s, LW, LH, time } = st;
    const camX = Math.round(st.camX), camY = Math.round(st.camY);
    sky(ctx, LW, LH, time);
    for (const L of LAYERS) {
      // at the surface every layer meets the town's ground; below it they drift up slower than the town
      const dy = Math.round(-(st.camY0 + (camY - st.camY0) * L.p));
      ctx.drawImage(L.c, Math.round(camX * L.p), 0, LW, 260, 0, dy, LW, 260);
      if (L.fog) {
        const fy = 232 + dy;
        const g = ctx.createLinearGradient(0, fy - 50, 0, fy + 10);
        g.addColorStop(0, 'rgba(30,37,50,0)'); g.addColorStop(1, 'rgba(30,37,50,0.55)');
        ctx.fillStyle = g; ctx.fillRect(0, fy - 50, LW, 60);
      }
      if (L.eyes) drawEyes(ctx, L, camX, dy, LW, st.still, time, Math.round(s.x + 2.5 - camX));
    }
    // a band of mist between the woods and the town
    {
      const fy = GY - camY;
      for (let k = 0; k < 3; k++) {
        const off = ((time * (3 + k * 2) + k * 300) - camX * (0.8 + k * 0.05)) % 400;
        for (let X = -400; X < LW + 400; X += 400) {
          const g = ctx.createRadialGradient(X + off, fy - 12 - k * 8, 0, X + off, fy - 12 - k * 8, 130);
          g.addColorStop(0, 'rgba(46,54,70,0.20)'); g.addColorStop(1, 'rgba(46,54,70,0)');
          ctx.fillStyle = g; ctx.fillRect(X + off - 130, fy - 80, 260, 120);
        }
      }
    }
    // the town
    ctx.drawImage(WC, camX, camY, LW, LH, 0, 0, LW, LH);
    drawLive(ctx, st, camX, camY);
    // the Dweller and the SEEKER
    if (st.showPlayer !== false) {
      R.drawPlayer(ctx, s, camX, camY, 'body', 0);
      if (s.cmp) R.drawMini(ctx, s.cmpX - camX, s.cmpY - camY, time, 'on', s.face, 1);
    }
    R.drawParticles(ctx, camX, camY);
    // down the well the Dweller goes behind the ground: the cap and the earth are painted again, over it
    const inShaft = !st.inRoom && s.x + 5 > WELL.x0 * TS && s.x < (WELL.x1 + 1) * TS && s.y + s.h > GY - 12;
    if (inShaft) wellCap(ctx, camX, camY, true, true);
    // the night over everything, then the lights
    ctx.fillStyle = 'rgba(4,6,14,0.16)'; ctx.fillRect(0, 0, LW, LH);
    drawLights(ctx, st, camX, camY);
    if (st.showPlayer !== false && !(inShaft && s.y + 3 > GY - 12)) R.drawPlayer(ctx, s, camX, camY, 'visor', 0);
    // snow, drifting slowly
    for (const f of snow) {
      f.y += f.v * (st.dt || 0) / 240; if (f.y > 1) { f.y -= 1; f.x = Math.random(); }
      const X = Math.round(((f.x * (LW + 40) - camX * f.z * 0.4) % (LW + 40) + LW + 40) % (LW + 40) - 20 + Math.sin(time * 0.6 + f.d) * 6), Y = Math.round(f.y * LH);
      ctx.globalAlpha = 0.25 + f.z * 0.25; ctx.fillStyle = '#b8c3d0'; ctx.fillRect(X, Y, 1, 1);
    }
    ctx.globalAlpha = 1;
    // the front silhouettes
    ctx.drawImage(FRONT.c, Math.round(camX * FRONT.p), Math.round(st.camY0 + (camY - st.camY0) * FRONT.p), LW, LH, 0, 0, LW, LH);
    // a vignette
    const vg = ctx.createRadialGradient(LW / 2, LH * 0.55, LH * 0.35, LW / 2, LH * 0.55, LH * 1.0);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, LW, LH);
  }

  /* doors' insides, the residents, smoke, the sockets of the great door, the sleeper under the well */
  function doorShape(d) {
    switch (d.kind) {
      case 'house': return { x: d.x + 8, y: GY, w: 12, h: 20, arch: 0 };
      case 'tree': return { x: d.x, y: GY, w: 18, h: 24, arch: 9 };
      case 'glass': return { x: d.x, y: GY, w: 28, h: 28, arch: 18 };
      case 'forge': return { x: d.x + 2, y: GY, w: 16, h: 20, arch: 0 };
      case 'ember': return { x: d.x, y: GY, w: 16, h: 17, arch: 8 };
      case 'heart': return { x: d.x, y: GY, w: 22, h: 24, arch: 17 };
    }
  }
  function fillDoor(ctx, sh, camX, camY, col) {
    const X = sh.x - camX, Y = sh.y - camY;
    for (let j = 0; j < sh.h; j++) {
      const top = sh.h - sh.arch;
      const half = j >= top && sh.arch ? Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((j - top) / sh.arch, 2))) * sh.w / 2) : sh.w / 2;
      if (half <= 0) continue;
      ctx.fillStyle = typeof col === 'function' ? col(j / sh.h) : col;
      ctx.fillRect(Math.round(X - half), Math.round(Y - j - 1), Math.round(half * 2), 1);
    }
  }
  /* the well looks capped with brick: a WELL kept secret. The cap is only paint; step onto it and you drop
     through, and from then on (while you are in the well) the cap is gone so you can see your way back up */
  /* what the ground under the well would look like if there were no well: solid earth and rock (baked once) */
  let COV = null;
  function buildCover() {
    const rx0 = WELL.room[0] - 1, rx1 = WELL.room[1] + 1, ry1 = WELL.room[3] + 1, w = (rx1 - rx0) * TS, h = (ry1 + 1) * TS - GY;
    const [c, x] = canvas(w, h), r = rng(31);
    rect(x, PALT.rock, 0, 0, w, h);
    for (let ty = 0; ty < h / TS; ty++) for (let tx = 0; tx < w / TS; tx++) if (r() < 0.18) rect(x, PALT.rock2, tx * TS + Math.floor(r() * 4), ty * TS + Math.floor(r() * 4), 2 + Math.floor(r() * 3), 1 + Math.floor(r() * 2));
    rect(x, PALT.earth, 0, 0, w, TS + 2);
    for (let X = 0; X < w; X++) { const k = r(); rect(x, PALT.topsoil, X, 0, 1, 2 + (k < 0.3 ? 1 : 0)); if (k < 0.55) rect(x, PALT.frost, X, 0, 1, 1); }
    COV = c;
  }
  /* the well looks capped with brick, and below the cap there is only earth and rock, all the way down: a WELL kept
     secret. It is only paint; step onto the cap and you drop through. The cave itself shows only once you are in it */
  function wellCap(ctx, camX, camY, inRoom, shaftOnly) {
    const x0 = (WELL.x0 + 1) * TS - camX, w = (WELL.x1 - WELL.x0 - 1) * TS, top = GY - 12 - camY;
    const rx0 = WELL.room[0] - 1, rx1 = WELL.room[1] + 1, ry0 = WELL.room[2], ry1 = WELL.room[3] + 1, cx0 = rx0 * TS;
    if (!COV) buildCover();
    // the shaft, under earth and rock
    // (a tile wider on each side than the shaft, so not even the lit edges of its walls show)
    const sx = WELL.x0 * TS - cx0, sw = (WELL.x1 - WELL.x0 + 1) * TS, sh = (ry0 - 1) * TS - GY - 2;
    ctx.drawImage(COV, sx, 2, sw, sh, WELL.x0 * TS - camX, GY + 2 - camY, sw, sh);
    if (inRoom || shaftOnly) ctx.drawImage(COV, sx + TS, 2 + sh, w, 3 * TS, x0, GY + 2 + sh - camY, w, 3 * TS);
    // the cave, until you are in it
    if (!inRoom && !shaftOnly) ctx.drawImage(COV, 0, (ry0 - 1) * TS - GY, (rx1 - rx0) * TS, (ry1 - ry0 + 2) * TS, cx0 - camX, (ry0 - 1) * TS - camY, (rx1 - rx0) * TS, (ry1 - ry0 + 2) * TS);
    for (let j = 0; j < 14; j++) {
      const y = top + j, row = Math.floor(j / 3), mortar = j % 3 === 2;
      ctx.fillStyle = mortar ? PALT.st0 : PALT.st2; ctx.fillRect(x0, y, w, 1);
      if (!mortar) for (let X = (row % 2) * 3; X < w; X += 6) { ctx.fillStyle = PALT.st0; ctx.fillRect(x0 + X, y, 1, 1); }
    }
    ctx.fillStyle = PALT.st3; ctx.fillRect(x0, top, w, 1);
  }
  function drawLive(ctx, st, camX, camY) {
    const { P, time } = st;
    // the doors: dark while sealed, a pale breath while the sliver still waits below, its colour once found
    for (const d of DOORS) {
      const sh = doorShape(d);
      if (sh.x - camX < -60 || sh.x - camX > st.LW + 60) continue;
      const beaten = P.beaten[d.i], open = st.unlocked(d.i);
      if (beaten) {
        const c = rgb(R.SHARDS[d.i]);
        fillDoor(ctx, sh, camX, camY, (u) => { const k = 0.35 + 0.35 * u + 0.12 * Math.sin(time * 2 + u * 9 + d.i); return 'rgba(' + Math.round(c[0] * k) + ',' + Math.round(c[1] * k) + ',' + Math.round(c[2] * k) + ',1)'; });
        // a slow swirl of motes inside
        for (let k = 0; k < 8; k++) {
          const a = time * 0.8 + k * 0.785, rr = (k % 3 + 1) * sh.w / 8;
          const X = sh.x - camX + Math.cos(a) * rr, Y = sh.y - camY - sh.h * 0.45 + Math.sin(a) * rr * 0.8;
          ctx.fillStyle = k % 2 ? '#ffffff' : R.shade(R.SHARDS[d.i], 0.5); ctx.fillRect(Math.round(X), Math.round(Y), 1, 1);
        }
      } else if (open) {
        fillDoor(ctx, sh, camX, camY, (u) => 'rgba(' + Math.round(18 + 10 * Math.sin(time * 1.5 + u * 6)) + ',' + Math.round(22 + 10 * Math.sin(time * 1.5 + u * 6)) + ',' + Math.round(30 + 12 * Math.sin(time * 1.5 + u * 6)) + ',1)');
      } else {
        // sealed: two boards across
        const X = sh.x - camX, Y = sh.y - camY;
        ctx.fillStyle = PALT.wood1; ctx.fillRect(Math.round(X - sh.w / 2 - 1), Math.round(Y - sh.h * 0.35), sh.w + 2, 2); ctx.fillRect(Math.round(X - sh.w / 2 - 1), Math.round(Y - sh.h * 0.7), sh.w + 2, 2);
        ctx.fillStyle = PALT.woodH; ctx.fillRect(Math.round(X - sh.w / 2 - 1), Math.round(Y - sh.h * 0.35), sh.w + 2, 1);
      }
      // the numeral over every door
      st.text(['I', 'II', 'III', 'IV', 'V', 'VI'][d.i], sh.x - camX, sh.y - camY - sh.h - 6, beaten ? R.shade(R.SHARDS[d.i], 0.2) : open ? '#6f7887' : '#4a5160', 'center');
    }
    // chimney smoke from the forge and the first house
    for (const [sx, sy, k0] of [[148 * TS - 12, GY - 72, 0], [44 * TS + 12, GY - 53, 3]]) {
      for (let k = 0; k < 9; k++) {
        const u = ((time * 0.18 + k / 9 + k0) % 1);
        const X = sx + Math.sin(u * 5 + k) * 3 + u * 14 - camX, Y = sy - u * 46 - camY;
        ctx.globalAlpha = (1 - u) * 0.30; ctx.fillStyle = '#4a5260';
        const rr = 1 + Math.round(u * 4); ctx.fillRect(Math.round(X - rr), Math.round(Y - rr), rr * 2, rr * 2);
      }
    }
    ctx.globalAlpha = 1;
    // the residents
    for (const q of RES) {
      const sh = RSHEET[q.id]; if (!sh) continue;
      const f = Math.floor(time * 12 + q.x) % 24;
      R.drawFrame(ctx, sh, f, q.x - camX, GY - camY, q.face < 0);
      // a new coat is ready: the spool you brought floats above the weaver
      if (q.id === 'weaver' && st.coatNew) { glow(ctx, q.x - camX, GY - camY - 27, 7, st.coatNew.glow || st.coatNew.main || '#b9a87b', 0.22 + 0.08 * Math.sin(time * 3)); R.drawSpool(ctx, q.x - camX, GY - camY - 22 + Math.round(Math.sin(time * 2)), 1, st.coatNew, time); }
    }
    // the great door's sockets: six around a seventh; filled once the crystal is set
    {
      const cx = GREAT.x - camX, cy = GREAT.y - camY - 42;
      const fu = st.fuse, set = P.fused || (fu >= 0 && fu > 2.2);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 3, X = Math.round(cx + Math.cos(a) * 10), Y = Math.round(cy + Math.sin(a) * 6);
        ctx.fillStyle = '#07080b'; ctx.fillRect(X - 1, Y - 2, 3, 4);
        if (set) { ctx.fillStyle = R.SHARDS[i]; ctx.fillRect(X - 1, Y - 2, 3, 4); ctx.fillStyle = '#fff'; ctx.fillRect(X, Y - 1, 1, 1); }
        else if (P.beaten[i]) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 2 + i); ctx.fillStyle = R.SHARDS[i]; ctx.fillRect(X, Y - 1, 1, 2); ctx.globalAlpha = 1; }
      }
      if (set) R.drawGem(ctx, cx, cy, 0.42, [true, true, true, true, true, true], time, true);
      else { ctx.fillStyle = '#07080b'; ctx.fillRect(cx - 3, cy - 5, 7, 10); }
      // open: the leaves are gone, and there is only light
      if (P.fused || (fu >= 0 && fu > 2.6)) {
        const k = P.fused ? 1 : Math.min(1, (fu - 2.6) / 1.2);
        const sh = { x: GREAT.x, y: GREAT.y, w: 40, h: 34, arch: 0 };
        fillDoor(ctx, sh, camX, camY, P.core ? (u) => 'rgba(' + Math.round(90 + 40 * u) + ',' + Math.round(190 + 30 * u) + ',' + Math.round(175 + 20 * u) + ',' + (k * (0.5 + 0.25 * Math.sin(time * 2 + u * 7))).toFixed(3) + ')' : (u) => 'rgba(' + Math.round(200 + 40 * u) + ',' + Math.round(196 + 30 * u) + ',' + Math.round(230 + 20 * u) + ',' + (k * (0.55 + 0.25 * Math.sin(time * 2 + u * 7))).toFixed(3) + ')');
      }
    }
    // the sleeper at the bottom of the well
    {
      const X = RAREX - camX, Y = RAREY - camY;
      if (Y > -20 && Y < st.LH + 20) {
        ctx.fillStyle = PALT.st1; ctx.fillRect(Math.round(X - 6), Math.round(Y - 4), 13, 4); ctx.fillStyle = PALT.st2; ctx.fillRect(Math.round(X - 6), Math.round(Y - 4), 13, 1);
        if (!st.rareUsed) {
          // a dormant seeker, a bonus one; its screen beats slowly
          ctx.globalAlpha = 0.85; R.drawPortrait(ctx, X, Y - 16, 0.33, 0.9, st.rareId); ctx.globalAlpha = 1;
        } else if (st.oldId) {
          ctx.globalAlpha = 0.7; R.drawPortrait(ctx, X, Y - 16, 0.33, 0.55, st.oldId); ctx.globalAlpha = 1;
        }
        // pale mushrooms in the room
        for (const [mx, h] of [[-80, 3], [-74, 5], [-40, 2], [26, 4], [34, 2], [44, 6]]) {
          const MX = Math.round(X + mx), MY = Math.round(Y);
          if (D.solidAt(TW, Math.floor((RAREX + mx) / TS), Math.floor((RAREY - 1) / TS))) continue;
          ctx.fillStyle = '#4f6366'; ctx.fillRect(MX, MY - h, 1, h); ctx.fillStyle = '#8ec3b9'; ctx.fillRect(MX - 1, MY - h - 1, 3, 1);
        }
      }
    }
    wellCap(ctx, camX, camY, st.inRoom);
  }
  function drawLights(ctx, st, camX, camY) {
    const { P, time, LW } = st;
    ctx.globalCompositeOperation = 'lighter';
    for (const d of DOORS) {
      const sh = doorShape(d), X = sh.x - camX, Y = sh.y - camY - sh.h * 0.5;
      if (X < -80 || X > LW + 80) continue;
      const fl = st.flare && st.flare.i === d.i ? Math.max(0, Math.min(1, 1 - st.flare.t / 1.8)) : 0;
      if (P.beaten[d.i]) {
        glow(ctx, X, Y, 34 + fl * 40, R.SHARDS[d.i], 0.22 + 0.05 * Math.sin(time * 2 + d.i) + fl * 0.5);
        glow(ctx, X, sh.y - camY, 26, R.SHARDS[d.i], 0.10);                     // spill on the ground
      } else if (st.unlocked(d.i)) glow(ctx, X, Y, 20, '#b8c6d8', 0.05 + 0.03 * Math.sin(time * 1.5));
    }
    // windows and lanterns: cold and dim
    for (const [wxp, wyp] of [[44 * TS - 10, GY - 20], [126 * TS - 12, GY - 22], [126 * TS + 12, GY - 22], [126 * TS + 1, GY - 42]]) glow(ctx, wxp - camX, wyp - camY, 14, PALT.win, 0.06 + 0.02 * Math.sin(time * 3 + wxp));
    for (const tx of [30, 64, 104, 140, 176]) glow(ctx, tx * TS - 4 - camX, GY - 21 - camY, 10, PALT.win, 0.07);
    // the great door
    {
      const X = GREAT.x - camX, Y = GREAT.y - camY - 30;
      if (P.core) { glow(ctx, X, Y, 90, '#7fd6c4', 0.18 + 0.05 * Math.sin(time * 1.3)); if (P.archNew) glow(ctx, X, Y - 28, 14 + 4 * Math.sin(time * 4), '#c8d8ff', 0.35 + 0.2 * Math.sin(time * 4)); }
      else if (P.fused || st.fuse > 2.6) glow(ctx, X, Y, 90, '#d8d4ff', 0.20 + 0.05 * Math.sin(time * 1.3));
      else if (P.beaten.every(Boolean)) glow(ctx, X, Y - 28, 22, '#ffffff', 0.06 + 0.04 * Math.sin(time * 3));
    }
    // the ember hut's coals and the forge
    glow(ctx, 168 * TS - camX, GY - 3 - camY, 14, '#7a3b2c', 0.12 + 0.04 * Math.sin(time * 5));
    // fireflies: cold motes that wander over the brambles
    for (const m of motes) {
      const X = m.x + Math.sin(time * m.sp + m.ph) * 16 - camX, Y = m.y + Math.sin(time * m.sp * 1.7 + m.ph * 2) * 6 - camY;
      if (X < -10 || X > LW + 10) continue;
      const a = 0.5 + 0.5 * Math.sin(time * 2.2 + m.ph * 3);
      glow(ctx, X, Y, 5, '#a6e0cf', 0.12 * a);
      ctx.fillStyle = 'rgba(200,240,228,' + (0.6 * a).toFixed(3) + ')'; ctx.fillRect(Math.round(X), Math.round(Y), 1, 1);
    }
    // under the well: the sleeper's soft light
    if (!st.rareUsed && st.inRoom) glow(ctx, RAREX - camX, RAREY - 16 - camY, 30, '#7fc2b2', 0.12 + 0.05 * Math.sin(time * 1.4));
    ctx.globalCompositeOperation = 'source-over';
  }

  /* the words on the signs, the prompts over doors and the residents' lines are drawn by main.js on top */
  /* text(t, x, y, colour, align) draws at half size; hs is how many town pixels one letter pixel takes */
  function signText(ctx, camX, camY, touch, hasCmp, text, hs) {
    camX = Math.round(camX); camY = Math.round(camY);
    const bh = Math.ceil(7 * hs) + 3;
    for (const s of SIGNS) {
      const ls = touch ? s.touch() : s.lines();
      const words = ls.map(ln => ln[1] ? ln[0] + '  ' + ln[1] : ln[0]);
      const bw = Math.ceil(Math.max(...words.map(t => R.textWidth(t))) * hs) + 6;
      const X = s.x - camX;
      words.forEach((t, k) => {
        const Y = GY - POST + 1 + k * (bh + 1) - camY, w = bw - (k === 1 ? 2 : 0);
        rect(ctx, PALT.wood0, X - w / 2 - 1, Y - 1, w + 2, bh + 2);
        rect(ctx, PALT.wood2, X - w / 2, Y, w, bh);
        rect(ctx, PALT.woodH, X - w / 2, Y, w, 1);
        rect(ctx, '#11100e', X - w / 2 + 1, Y + 1, 1, 1); rect(ctx, '#11100e', X + w / 2 - 2, Y + 1, 1, 1);
        text(t, X, Y + 2, k === 2 && s === SIGNS[1] && !hasCmp ? '#6a5e4e' : '#c9bb9f', 'center');
      });
    }
  }

  global.DwellerTown = {
    build, draw, signText, GY, W, H, TS, WPX, HPX, DOORS, GREAT, RES, WELLX, RAREX, RAREY, WELL, doorShape, groundAt,
    get world() { return TW; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
