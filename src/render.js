/* DWELLER — renderer. Draws at a low logical resolution (pixel art), the caller scales it up by whole numbers.
 * Art direction (The Seeker): low saturation, no outlines, one focal point, depth by layering,
 * drawn fully lit and then darkened by a post-process light pass.
 */
(function (global) {
  'use strict';
  const D = global.Dweller;
  const TS = D.TS;
  const smooth = D.smooth;

  /* ------------------------------------------------------------------ palette (The Seeker) */
  const PAL = {
    void: '#0F0E16', stone0: '#181C20', stone1: '#20242A', stone2: '#353E50', stone3: '#4F5D73', stone4: '#667389',
    stone5: '#94A6B1', gold: '#B9A87B', snow: '#EDF0F1', ice: '#C4CED4',
    cold0: '#698F9B', cold1: '#7BACBC', cold2: '#91CBDE', cold3: '#D6EDF5',
    ui: '#F0F2E8', muted: '#8A919E',
  };

  /* ------------------------------------------------------------------ level themes
   * Colour follows place: the upper caves are cold and pale, the deep ones warmer and stranger.
   * Each level keeps one accent that nothing else in it shares: its sliver of the crystal. */
  const SHARDS = ['#ef5b5b', '#f39a4c', '#f1d663', '#6ad890', '#5ca8f2', '#a77cff', '#ffffff'];
  const THEMES = {
    descent: { style: 'descent', bgTop: [38, 48, 66], bgBot: [40, 38, 66], far: ['#2e3849', '#2b3545'], mid: '#242c3a', near: '#1a202b', tile: null,
      tuft: ['#4a566b', '#7d8da3'], glow: '#3b6f7e', stal: ['#20242A', '#4F5D73'], lamp: ['#3c5d6b', '#7BACBC', '#91CBDE'],
      orb: [[26, 48, 62], [110, 165, 186], [232, 246, 252]], glowRGB: '120,190,220', slit: '#7BACBC', dark: [5, 10, 16], sheen: '#6f6f96', pupil: '#D6EDF5', mote: null },
    mycelium: { style: 'fungal', bgTop: [26, 44, 42], bgBot: [24, 36, 40], far: ['#24403b', '#213a36'], mid: '#1b302b', near: '#13221e', tile: [[14, 24, 22], [58, 92, 82], [168, 208, 186]],
      tuft: ['#3d6a5a', '#9fe0c0'], glow: '#4fb08a', stal: ['#16241f', '#3e6656'], lamp: ['#2f5e4f', '#7fd4b2', '#c0f4dc'],
      orb: [[18, 46, 40], [104, 188, 156], [226, 252, 238]], glowRGB: '110,220,170', slit: '#7fd4b2', dark: [3, 10, 8], sheen: '#5f9a86', pupil: '#c0f4dc', mote: [120, 230, 180] },
    glass: { style: 'glass', bgTop: [34, 28, 56], bgBot: [40, 28, 62], far: ['#362c54', '#31284d'], mid: '#2a2244', near: '#1c1730', tile: [[20, 16, 36], [86, 70, 138], [214, 200, 252]],
      tuft: ['#5d4f94', '#d4c6ff'], glow: '#9a7ae0', stal: ['#1c1730', '#5a4b8c'], lamp: ['#4b3d7a', '#b9a2f4', '#e8deff'],
      orb: [[38, 28, 70], [158, 138, 232], [246, 242, 255]], glowRGB: '170,150,245', slit: '#b9a2f4', dark: [8, 5, 16], sheen: '#8a78c0', pupil: '#e8deff', mote: [210, 200, 255] },
    foundry: { style: 'foundry', bgTop: [42, 35, 33], bgBot: [46, 33, 29], far: ['#3d312c', '#382d29'], mid: '#2e241f', near: '#201915', tile: [[28, 21, 19], [108, 82, 68], [222, 194, 170]],
      tuft: ['#6b5546', '#c79a7c'], glow: '#c97a44', stal: ['#201915', '#5c4638'], lamp: ['#6b4a35', '#e8a878', '#ffdcbc'],
      orb: [[52, 30, 22], [214, 140, 96], [255, 236, 220]], glowRGB: '235,150,95', slit: '#e8a878', dark: [12, 7, 5], sheen: '#8c6c5c', pupil: '#ffdcbc', mote: [255, 170, 110] },
    ember: { style: 'ember', bgTop: [44, 22, 28], bgBot: [52, 18, 24], far: ['#40202a', '#3a1d25'], mid: '#2f171e', near: '#210f14', tile: [[28, 13, 17], [118, 50, 58], [242, 176, 166]],
      tuft: ['#7a3036', '#ff8f76'], glow: '#e8573f', stal: ['#210f14', '#6a2f36'], lamp: ['#7a2f2f', '#ff9078', '#ffd6ca'],
      orb: [[60, 18, 20], [232, 110, 92], [255, 232, 224]], glowRGB: '255,112,82', slit: '#ff9078', dark: [14, 4, 6], sheen: '#a05e5e', pupil: '#ffd6ca', mote: [255, 120, 80] },
    heart: { style: 'heart', bgTop: [38, 26, 42], bgBot: [28, 20, 38], far: ['#3c283e', '#362438'], mid: '#2c1d31', near: '#1c1321', tile: [[24, 17, 27], [118, 98, 108], [238, 228, 214]],
      tuft: ['#8a4f7a', '#f4b0dc'], glow: '#e676c4', stal: ['#1c1321', '#6e5866'], lamp: ['#6a3a64', '#f2a6de', '#ffe4f6'],
      orb: [[52, 26, 50], [226, 140, 204], [255, 238, 250]], glowRGB: '240,132,212', slit: '#f2a6de', dark: [10, 5, 12], sheen: '#9a6c92', pupil: '#ffe4f6', mote: [244, 160, 220] },
    core: { style: 'glass', bgTop: [20, 22, 34], bgBot: [12, 12, 22], far: ['#22263a', '#1e2134'], mid: '#181a2a', near: '#10111c', tile: [[12, 13, 22], [70, 76, 104], [220, 226, 244]],
      tuft: ['#4c5578', '#c8d2f4'], glow: '#8fa6e8', stal: ['#10111c', '#4a5274'], lamp: ['#3e4770', '#b8c6f4', '#eef2ff'],
      orb: [[28, 30, 50], [150, 165, 230], [244, 246, 255]], glowRGB: '190,205,255', slit: '#c8d4ff', dark: [4, 4, 9], sheen: '#7d86b0', pupil: '#eef2ff', mote: [200, 210, 255] },
  };
  let TH = THEMES.descent, shardCol = SHARDS[0], levelIdx = 0;

  /* ------------------------------------------------------------------ font (5x7) */
  const G = {};
  function def(ch, rows) { G[ch] = rows.split('/'); }
  def('A', '.###./#...#/#...#/#####/#...#/#...#/#...#'); def('B', '####./#...#/#...#/####./#...#/#...#/####.');
  def('C', '.####/#..../#..../#..../#..../#..../.####'); def('D', '####./#...#/#...#/#...#/#...#/#...#/####.');
  def('E', '#####/#..../#..../####./#..../#..../#####'); def('F', '#####/#..../#..../####./#..../#..../#....');
  def('G', '.####/#..../#..../#..##/#...#/#...#/.####'); def('H', '#...#/#...#/#...#/#####/#...#/#...#/#...#');
  def('I', '.###./..#../..#../..#../..#../..#../.###.'); def('J', '..###/...#./...#./...#./...#./#..#./.##..');
  def('K', '#...#/#..#./#.#../##.../#.#../#..#./#...#'); def('L', '#..../#..../#..../#..../#..../#..../#####');
  def('M', '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#'); def('N', '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#');
  def('O', '.###./#...#/#...#/#...#/#...#/#...#/.###.'); def('P', '####./#...#/#...#/####./#..../#..../#....');
  def('Q', '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#'); def('R', '####./#...#/#...#/####./#.#../#..#./#...#');
  def('S', '.####/#..../#..../.###./....#/....#/####.'); def('T', '#####/..#../..#../..#../..#../..#../..#..');
  def('U', '#...#/#...#/#...#/#...#/#...#/#...#/.###.'); def('V', '#...#/#...#/#...#/#...#/#...#/.#.#./..#..');
  def('W', '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#'); def('X', '#...#/#...#/.#.#./..#../.#.#./#...#/#...#');
  def('Y', '#...#/#...#/.#.#./..#../..#../..#../..#..'); def('Z', '#####/....#/...#./..#../.#.../#..../#####');
  def('0', '.###./#...#/#..##/#.#.#/##..#/#...#/.###.'); def('1', '..#../.##../..#../..#../..#../..#../.###.');
  def('2', '.###./#...#/....#/...#./..#../.#.../#####'); def('3', '####./....#/....#/.###./....#/....#/####.');
  def('4', '...#./..##./.#.#./#..#./#####/...#./...#.'); def('5', '#####/#..../####./....#/....#/#...#/.###.');
  def('6', '.###./#..../#..../####./#...#/#...#/.###.'); def('7', '#####/....#/...#./..#../.#.../.#.../.#...');
  def('8', '.###./#...#/#...#/.###./#...#/#...#/.###.'); def('9', '.###./#...#/#...#/.####/....#/....#/.###.');
  def('.', '...../...../...../...../...../.##../.##..'); def(',', '...../...../...../...../.##../..#../.#...');
  def(':', '...../.##../.##../...../.##../.##../.....'); def('!', '..#../..#../..#../..#../..#../...../..#..');
  def('?', '.###./#...#/....#/...#./..#../...../..#..'); def('-', '...../...../...../.###./...../...../.....');
  def('+', '...../..#../..#../#####/..#../..#../.....'); def('/', '....#/....#/...#./..#../.#.../#..../#....');
  def("'", '..#../..#../.#.../...../...../...../.....'); def('(', '...#./..#../.#.../.#.../.#.../..#../...#.');
  def(')', '.#.../..#../...#./...#./...#./..#../.#...'); def('=', '...../...../#####/...../#####/...../.....');
  def('%', '##..#/##..#/...#./..#../.#.../#..##/#..##'); def('_', '...../...../...../...../...../...../#####');
  def('*', '...../#.#.#/.###./#####/.###./#.#.#/.....'); def('<', '...../..#../.#.../#####/.#.../..#../.....');
  def('>', '...../..#../...#./#####/...#./..#../.....'); def('^', '..#../.###./#.#.#/..#../..#../..#../.....');
  def('~', '...../..#../..#../..#../#.#.#/.###./..#..'); def('#', '.#.#./#####/.#.#./.#.#./.#.#./#####/.#.#.'); def(' ', '...../...../...../...../...../...../.....');
  const textCache = new Map();
  function textSprite(text, color) {
    const key = color + '|' + text;
    let c = textCache.get(key);
    if (c) return c;
    let w = 0;
    for (const ch of text) w += ch === ' ' ? 4 : 6;
    w = Math.max(1, w - 1);
    c = document.createElement('canvas'); c.width = w; c.height = 7;
    const x = c.getContext('2d'); x.fillStyle = color;
    let px = 0;
    for (const ch of text) {
      const g = G[ch] || G[ch.toUpperCase()] || G['?'];
      if (ch !== ' ') for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === '#') x.fillRect(px + q, r, 1, 1);
      px += ch === ' ' ? 4 : 6;
    }
    if (textCache.size > 400) textCache.clear();
    textCache.set(key, c);
    return c;
  }
  function textWidth(text) { let w = 0; for (const ch of text) w += ch === ' ' ? 4 : 6; return Math.max(0, w - 1); }
  function drawText(ctx, text, x, y, color, scale, align) {
    const sp = textSprite(text, color || '#fff');
    scale = scale || 1;
    let dx = x;
    if (align === 'center') dx = x - Math.floor(sp.width * scale / 2);
    else if (align === 'right') dx = x - sp.width * scale;
    ctx.drawImage(sp, Math.round(dx), Math.round(y), sp.width * scale, sp.height * scale);
  }

  /* ------------------------------------------------------------------ assets */
  const IMG = {};
  const SHEETS = {};
  function loadImage(src) {
    return new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => fail(new Error('image failed')); i.src = src; });
  }
  function canvasOf(img) {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); return c;
  }
  function remap(canvas, map) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
      const m = map[k];
      if (m) { d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2]; }
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  function coldTint(canvas, ramp) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    const R = ramp || [[26, 48, 62], [110, 165, 186], [232, 246, 252]];
    const lo = R[0], mid = R[1], hi = R[2];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const l = Math.min(1, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 235);
      const u = l < 0.5 ? l * 2 : (l - 0.5) * 2, a = l < 0.5 ? lo : mid, b = l < 0.5 ? mid : hi;
      d[i] = a[0] + (b[0] - a[0]) * u; d[i + 1] = a[1] + (b[1] - a[1]) * u; d[i + 2] = a[2] + (b[2] - a[2]) * u;
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  function whiteOnly(canvas) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
    const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0 || Math.min(d[i], d[i + 1], d[i + 2]) < 232) d[i + 3] = 0;
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  /* Standing still: the calm pose from the idle sheet (cloak closed, a thin line between the legs),
   * breathing by lowering the hood and shoulders a pixel, with a visor blink now and then.
   * Three frames: 0 rest, 1 breath, 2 blink. Built from the sheet so it always matches the art. */
  function buildBreath() {
    const src = IMG.idle, c = document.createElement('canvas'); c.width = 96 * 3; c.height = 96;
    const x = c.getContext('2d'), FX = 3 * 96, WAIST = 48;
    for (let k = 0; k < 3; k++) x.drawImage(src, FX, 0, 96, 96, k * 96, 0, 96, 96);
    x.clearRect(96, 0, 96, WAIST);
    x.drawImage(src, FX, 0, 96, WAIST - 1, 96, 1, 96, WAIST - 1);          // the breath: hood and shoulders down 1px
    const id = x.getImageData(192, 0, 96, 96), d = id.data;               // the blink: the visor dims
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) { d[i] = 150; d[i + 1] = 160; d[i + 2] = 170; }
    x.putImageData(id, 192, 0);
    sheet('breath', c, 3, 1, 96, 96, 48, 54);
  }
  // 54 frames at 12 fps (4.5 s): breathe twice, blink, breathe once more
  const BREATH = [].concat(Array(9).fill(0), Array(9).fill(1), Array(9).fill(0), Array(9).fill(1),
    Array(3).fill(0), [2, 2], Array(4).fill(0), Array(9).fill(1));
  function sheet(name, canvas, cols, rows, w, h, ax, ay) {
    const s = { cv: canvas, cols, rows, w, h, ax, ay, n: cols * rows };
    SHEETS[name] = s; return s;
  }
  function drawFrame(ctx, sh, idx, x, y, flip, alpha) {
    idx = Math.max(0, Math.min(sh.n - 1, idx | 0));
    const sx = (idx % sh.cols) * sh.w, sy = Math.floor(idx / sh.cols) * sh.h;
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1);
      ctx.drawImage(sh.cv, sx, sy, sh.w, sh.h, -sh.ax, Math.round(y) - sh.ay, sh.w, sh.h);
      ctx.restore();
    } else {
      ctx.drawImage(sh.cv, sx, sy, sh.w, sh.h, Math.round(x) - sh.ax, Math.round(y) - sh.ay, sh.w, sh.h);
    }
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  }

  async function load(assets) {
    const names = Object.keys(assets);
    const imgs = await Promise.all(names.map(n => loadImage(assets[n])));
    names.forEach((n, i) => { IMG[n] = canvasOf(imgs[i]); });
    const P = (n, c, r, w, h, ax, ay) => sheet(n, IMG[n], c, r, w, h, ax, ay);
    P('idle', 12, 2, 96, 96, 48, 54); P('run', 10, 1, 48, 48, 24, 30); P('jump', 12, 1, 48, 48, 24, 30);
    P('fall', 6, 2, 48, 48, 24, 30); P('roll', 4, 1, 48, 48, 24, 30); P('wall', 3, 1, 96, 96, 47, 54);
    P('death', 7, 1, 48, 48, 24, 30);
    buildBreath();
    for (const k of ['idle', 'run', 'jump', 'fall', 'roll', 'wall', 'death', 'breath']) {
      const s = SHEETS[k];
      sheet(k + 'V', whiteOnly(s.cv), s.cols, s.rows, s.w, s.h, s.ax, s.ay);
    }
    // Tether (checkpoint), watcher eye + roots, orb
    P('tether', 24, 1, 48, 48, 24, 47);
    P('voidBody', 1, 1, 48, 48, 24, 24);
    const cold = {
      '182,193,33': [145, 203, 222], '225,255,146': [214, 237, 245], '55,87,53': [48, 78, 92],
      '159,185,115': [123, 172, 188], '94,136,91': [105, 143, 155],
    };
    sheet('orb', coldTint(IMG.orb), 8, 1, 48, 48, 24, 24);
    buildSeekerSprites();
    // eye: sprite without its pupil (we paint the pupil ourselves so it can look along the beam)
    const eye = document.createElement('canvas'); eye.width = 48; eye.height = 48;
    { const x = eye.getContext('2d'); x.drawImage(IMG.voidFace, 0, 0);
      const id = x.getImageData(0, 0, 48, 48), d = id.data;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] > 200) { d[i] = d[i + 1] = d[i + 2] = 6; }
      x.putImageData(id, 0, 0); }
    sheet('eye', eye, 1, 1, 48, 48, 24, 24);
    buildTiles();
  }

  /* ------------------------------------------------------------------ terrain tiles
   * Baked offline by tools/bake_levels.cjs (bake_terrain.cjs) with The Seeker's ice-biome terrain tiling: mosaic
   * rules split the rock into four shades, then the LDtk "Main" layer rules choose every tile. Each level has a
   * `terrain<N>` asset with one pixel per cell: its tile in `tiles` (MainTilesetAdditions) as red + green * 256, its
   * flips in blue (bit 0 x, bit 1 y), and no alpha where no tile is drawn. Deeper levels tint the same tileset. */
  const TILES_PER_ROW = 17;
  let tileFlip = null, cells = null, cellsW = 0, cellsH = 0;
  function buildTiles() { }
  function mirrorSet(cv) {
    const mirrored = (sx, sy) => {
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
      const x = c.getContext('2d'); x.translate(sx < 0 ? c.width : 0, sy < 0 ? c.height : 0); x.scale(sx, sy); x.drawImage(cv, 0, 0);
      return c;
    };
    return [cv, mirrored(-1, 1), mirrored(1, -1), mirrored(-1, -1)];
  }
  const tintCache = {};
  function themeTiles(th) {
    const k = th.tile ? th.style : 'plain';
    // solid rock reads a good step darker than the cave behind it, as in the ice biome
    const ramp = th.tile ? [th.bgTop.map(v => Math.round(v * 0.5)), th.tile[1], th.tile[2]] : null;
    if (!tintCache[k]) tintCache[k] = mirrorSet(ramp ? coldTint(IMG.tiles, ramp) : IMG.tiles);
    return tintCache[k];
  }
  const orbCache = {};
  function themeOrb(th) {
    const k = th.style;
    if (!orbCache[k]) orbCache[k] = { cv: coldTint(IMG.orb, th.orb), cols: 8, rows: 1, w: 48, h: 48, ax: 24, ay: 24, n: 8 };
    return orbCache[k];
  }

  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  function visSolid(w, x, y) {
    if (D.solidAt(w, x, y)) return true;
    return !!(w.fakeMask && x >= 0 && y >= 0 && x < w.W && y < w.H && w.fakeMask[y * w.W + x]);
  }
  /* one baked tile; false-wall cells are drawn only on their own layer (onlyFake) */
  function drawTerrainTile(ctx, w, tx, ty, px, py, onlyFake) {
    if (tx < 0 || ty < 0 || tx >= cellsW || ty >= cellsH) return;
    const isFake = !!(w.fakeMask && w.fakeMask[ty * w.W + tx]);
    if (isFake !== !!onlyFake) return;
    const i = (ty * cellsW + tx) * 4;
    if (cells[i + 3] < 255) return;
    const id = cells[i] + cells[i + 1] * 256, f = cells[i + 2] & 3, col = id % TILES_PER_ROW, row = Math.floor(id / TILES_PER_ROW);
    const cv = tileFlip[f];
    const sx = f & 1 ? TILES_PER_ROW - 1 - col : col, sy = f & 2 ? cv.height / TS - 1 - row : row;
    ctx.drawImage(cv, sx * TS, sy * TS, TS, TS, px, py, TS, TS);
  }

  const CH = 32;       // chunk size in tiles
  const chunks = new Map();
  function chunkCanvas(w, cx, cy) {
    const key = cx + ',' + cy;
    let c = chunks.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = CH * TS; c.height = CH * TS;
    const x = c.getContext('2d');
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) drawTerrainTile(x, w, cx * CH + i, cy * CH + j, i * TS, j * TS, false);
    chunks.set(key, c);
    return c;
  }

  /* ------------------------------------------------------------------ level dressing */
  let decor = null, bgLayers = null;

  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function buildDecor(w) {
    const r = rng(4802);
    const list = { hang: [], floor: [], glow: [], vines: [] };
    const S = (x, y) => visSolid(w, x, y);
    for (let x = 2; x < w.W - 2; x++) {
      for (let y = 4; y < w.H - 4; y++) {
        if (!S(x, y) && S(x, y - 1) && S(x, y - 2) && S(x, y - 3) && S(x - 1, y - 1) && S(x + 1, y - 1) && r() < 0.16) {   // stalactite under thick rock
          let free = 0; while (!S(x, y + free + 1) && free < 6) free++;
          const len = Math.min(free, 1 + Math.floor(r() * 3));
          if (len > 0) list.hang.push({ x, y, len, v: r() });
        }
        if (!S(x, y) && S(x, y + 1) && !S(x, y - 1) && r() < 0.045) {         // frost tufts on floors
          list.floor.push({ x, y, k: Math.floor(r() * 6), v: r() });
        }
      }
    }
    // luminous roots on floors (tiny cyan sparks, purely decorative)
    for (const f of list.floor) if (f.v > 0.82) list.glow.push({ x: f.x * TS + 3, y: f.y * TS + 5 });
    return list;
  }

  function makeBgLayer(seed, wpx, hpx, kind) {
    const c = document.createElement('canvas'); c.width = wpx; c.height = hpx;
    const x = c.getContext('2d'); const r = rng(seed);
    if (TH.style !== 'descent') { styledLayer(x, r, wpx, hpx, kind); return c; }
    if (kind === 0) {                 // far: soft rock arches, stars of dust
      for (let i = 0; i < 9; i++) {
        const cx = (i + 0.5) * wpx / 9 + (r() - 0.5) * 30, rw = 34 + r() * 40, top = hpx * (0.15 + r() * 0.25);
        x.fillStyle = r() < 0.5 ? '#2e3849' : '#2b3545';
        x.beginPath(); x.moveTo(cx - rw, hpx);
        for (let k = 0; k <= 16; k++) { const t = k / 16; const px = cx - rw + t * rw * 2; const py = top + (1 - Math.sin(t * Math.PI)) * (hpx - top) * 0.9; x.lineTo(px, py + r() * 6); }
        x.lineTo(cx + rw, hpx); x.closePath(); x.fill();
      }
    } else if (kind === 1) {          // mid: hanging spires and risers
      x.fillStyle = '#242c3a';
      for (let i = 0; i < 24; i++) {
        const px = Math.floor(r() * wpx), len = 20 + r() * 80, wd = 5 + r() * 12;
        x.beginPath(); x.moveTo(px - wd, 0); x.lineTo(px + wd, 0); x.lineTo(px + (r() - 0.5) * 3, len); x.closePath(); x.fill();
        const px2 = Math.floor(r() * wpx), len2 = 10 + r() * 50, wd2 = 6 + r() * 12;
        x.beginPath(); x.moveTo(px2 - wd2, hpx); x.lineTo(px2 + wd2, hpx); x.lineTo(px2 + (r() - 0.5) * 3, hpx - len2); x.closePath(); x.fill();
      }
    } else {                           // near: roots and columns
      x.fillStyle = '#1a202b';
      for (let i = 0; i < 10; i++) {
        const px = Math.floor(r() * wpx), wd = 3 + r() * 5;
        x.fillRect(px, 0, wd, hpx * (0.3 + r() * 0.6));
        x.fillRect(px + 1, hpx - 20 - r() * 70, wd - 1, 100);
      }
    }
    // dither the silhouettes edge a little
    return c;
  }

  /* background silhouettes for the deeper levels */
  function styledLayer(x, r, W, H, kind) {
    const st = TH.style;
    const col = kind === 0 ? TH.far : kind === 1 ? [TH.mid, TH.mid] : [TH.near, TH.near];
    const tri = (ax, ay, bx, by, cx, cy) => { x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(cx, cy); x.closePath(); x.fill(); };
    if (st === 'fungal') {
      if (kind === 0) for (let i = 0; i < 7; i++) {             // giant mushrooms far away
        x.fillStyle = col[i % 2]; const cx = (i + 0.5) * W / 7 + (r() - 0.5) * 30, top = H * (0.25 + r() * 0.3), cw = 30 + r() * 34, sw = 5 + r() * 6;
        x.fillRect(cx - sw / 2, top, sw, H - top);
        x.beginPath(); x.ellipse(cx, top, cw, 10 + r() * 10, 0, Math.PI, 0); x.fill();
        x.fillRect(cx - cw, top - 1, cw * 2, 3);
      } else if (kind === 1) for (let i = 0; i < 30; i++) {     // hanging mycelium threads
        x.fillStyle = col[0]; const px = Math.floor(r() * W), len = 20 + r() * 110;
        x.fillRect(px, 0, 1 + (r() < 0.3 ? 1 : 0), len);
        x.beginPath(); x.arc(px + 0.5, len, 2 + r() * 3, 0, Math.PI * 2); x.fill();
        const px2 = Math.floor(r() * W), h2 = 12 + r() * 40;          // little caps rising from below
        x.fillRect(px2, H - h2, 2, h2); x.beginPath(); x.ellipse(px2 + 1, H - h2, 6 + r() * 6, 4, 0, Math.PI, 0); x.fill();
      } else for (let i = 0; i < 8; i++) {
        x.fillStyle = col[0]; const px = Math.floor(r() * W), wd = 3 + r() * 4;
        x.fillRect(px, H - 40 - r() * 90, wd, 200);
        x.fillRect(px - 3, 0, wd + 2, 18 + r() * 60);
      }
    } else if (st === 'glass') {
      if (kind === 0) for (let i = 0; i < 11; i++) {            // crystal spires
        x.fillStyle = col[i % 2]; const cx = (i + 0.5) * W / 11 + (r() - 0.5) * 20, top = H * (0.12 + r() * 0.45), hw = 8 + r() * 16;
        x.beginPath(); x.moveTo(cx - hw, H); x.lineTo(cx - hw * 0.8, top + hw); x.lineTo(cx, top); x.lineTo(cx + hw * 0.8, top + hw); x.lineTo(cx + hw, H); x.closePath(); x.fill();
      } else if (kind === 1) for (let i = 0; i < 26; i++) {
        x.fillStyle = col[0]; const px = Math.floor(r() * W), len = 18 + r() * 70, wd = 4 + r() * 9, lean = (r() - 0.5) * 18;
        tri(px - wd, 0, px + wd, 0, px + lean, len);
        const p2 = Math.floor(r() * W), l2 = 14 + r() * 50, w2 = 4 + r() * 8;
        tri(p2 - w2, H, p2 + w2, H, p2 - lean, H - l2);
      } else for (let i = 0; i < 9; i++) {
        x.fillStyle = col[0]; const px = Math.floor(r() * W), wd = 2 + r() * 4, l = H * (0.2 + r() * 0.5);
        tri(px - wd, 0, px + wd, 0, px, l); tri(px - wd, H, px + wd, H, px + 2, H - l * 0.8);
      }
    } else if (st === 'foundry') {
      if (kind === 0) {                                          // cog wheels and arches
        for (let i = 0; i < 6; i++) {
          x.fillStyle = col[i % 2]; const cx = (i + 0.5) * W / 6 + (r() - 0.5) * 30, cy = H * (0.35 + r() * 0.4), R0 = 18 + r() * 22;
          x.beginPath(); x.arc(cx, cy, R0, 0, Math.PI * 2); x.fill();
          for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; x.save(); x.translate(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); x.rotate(a); x.fillRect(-3, -4, 7, 8); x.restore(); }
          x.fillRect(cx - 3, cy, 6, H - cy);
        }
      } else if (kind === 1) for (let i = 0; i < 14; i++) {     // pipes and chains
        x.fillStyle = col[0]; const py = Math.floor(r() * H * 0.6), px = Math.floor(r() * W), ln = 40 + r() * 140;
        x.fillRect(px, py, ln, 4); x.fillRect(px, py, 4, H - py); x.fillRect(px + ln - 4, py - 30 - r() * 60, 4, 34 + r() * 60);
        const cx2 = Math.floor(r() * W); for (let k = 0; k < 10 + r() * 14; k++) x.fillRect(cx2 + (k % 2), k * 4, 2, 3);
      } else for (let i = 0; i < 7; i++) {                       // girders
        x.fillStyle = col[0]; const px = Math.floor(r() * W);
        x.fillRect(px, 0, 3, H); x.fillRect(px + 9, 0, 3, H);
        for (let k = 0; k < H; k += 16) { x.fillRect(px, k, 12, 2); }
      }
    } else if (st === 'ember') {
      if (kind === 0) {                                          // jagged ridges
        for (let i = 0; i < 2; i++) {
          x.fillStyle = col[i]; x.beginPath(); x.moveTo(0, H);
          for (let px = 0; px <= W; px += 12) x.lineTo(px, H * (0.35 + 0.25 * i) + (r() - 0.3) * 60);
          x.lineTo(W, H); x.closePath(); x.fill();
        }
      } else if (kind === 1) for (let i = 0; i < 30; i++) {
        x.fillStyle = col[0]; const px = Math.floor(r() * W), len = 20 + r() * 100, wd = 3 + r() * 8;
        tri(px - wd, 0, px + wd, 0, px + (r() - 0.5) * 4, len);
        const p2 = Math.floor(r() * W), l2 = 10 + r() * 60;
        tri(p2 - wd, H, p2 + wd, H, p2, H - l2);
      } else for (let i = 0; i < 10; i++) {
        x.fillStyle = col[0]; const px = Math.floor(r() * W), wd = 3 + r() * 6;
        tri(px - wd, 0, px + wd, 0, px, H * (0.3 + r() * 0.5)); x.fillRect(px - 1, H - 30 - r() * 80, wd, 200);
      }
    } else {                                                     // heart: ribs, veins, tendons
      if (kind === 0) for (let i = 0; i < 5; i++) {
        x.strokeStyle = col[i % 2]; x.lineWidth = 7 + r() * 6; const cx = (i + 0.5) * W / 5, cy = H * (0.9 + r() * 0.2), R0 = 60 + r() * 60;
        x.beginPath(); x.arc(cx, cy, R0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
        x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, R0 * 0.62, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
      } else if (kind === 1) for (let i = 0; i < 16; i++) {
        x.strokeStyle = col[0]; x.lineWidth = 2 + r() * 2; let px = r() * W, py = 0;
        x.beginPath(); x.moveTo(px, py);
        const n = 6 + r() * 8; for (let k = 0; k < n; k++) { px += (r() - 0.5) * 18; py += 8 + r() * 10; x.lineTo(px, py); }
        x.stroke(); x.fillStyle = col[0]; x.beginPath(); x.arc(px, py, 2 + r() * 2, 0, Math.PI * 2); x.fill();
      } else for (let i = 0; i < 8; i++) {
        x.fillStyle = col[0]; const px = Math.floor(r() * W), wd = 4 + r() * 5;
        x.beginPath(); x.ellipse(px, H, wd, H * (0.3 + r() * 0.4), 0, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.ellipse(px + 30, 0, wd * 0.8, H * (0.15 + r() * 0.3), 0, 0, Math.PI * 2); x.fill();
      }
    }
  }

  function prepare(w, themeName, idx) {
    TH = THEMES[themeName] || THEMES.descent; levelIdx = idx || 0; shardCol = SHARDS[levelIdx] || SHARDS[0];
    tileFlip = themeTiles(TH); SHEETS.orbT = themeOrb(TH);
    const baked = IMG['terrain' + (levelIdx + 1)];
    if (!baked || baked.width !== w.W || baked.height !== w.H) throw new Error('the baked terrain is for another level: run tools/bake_levels.cjs');
    cellsW = baked.width; cellsH = baked.height;
    cells = baked.getContext('2d').getImageData(0, 0, cellsW, cellsH).data;
    w.fakeMask = new Uint8Array(w.W * w.H);
    for (const f of w.fakes) for (let y = f[1]; y < f[1] + f[3]; y++) for (let x = f[0]; x < f[0] + f[2]; x++) if (x >= 0 && y >= 0 && x < w.W && y < w.H) w.fakeMask[y * w.W + x] = 1;
    fakeCv = w.fakes.map(f => {
      const c = document.createElement('canvas'); c.width = (f[2] + 2) * TS; c.height = (f[3] + 2) * TS;
      const x = c.getContext('2d');
      for (let j = -1; j <= f[3]; j++) for (let i = -1; i <= f[2]; i++) drawTerrainTile(x, w, f[0] + i, f[1] + j, (i + 1) * TS, (j + 1) * TS, true);
      return { f, c, a: 1 };
    });
    decor = buildDecor(w);
    bgLayers = [makeBgLayer(11, 512, 300, 0), makeBgLayer(23, 512, 300, 1), makeBgLayer(37, 512, 300, 2)];
    chunks.clear();
  }

  let fakeCv = [];
  function crumble(f) {
    for (let j = 0; j < f[3]; j++) for (let i = 0; i < f[2]; i++) for (let k = 0; k < 2; k++)
      spawn((f[0] + i) * TS + Math.random() * TS, (f[1] + j) * TS + Math.random() * TS, (Math.random() - 0.5) * 30, Math.random() * 20, 0.9 + Math.random() * 0.8, k ? TH.stal[1] : TH.near, 2, 260);
  }
  function drawFakes(ctx, w, s, camX, camY, dt) {
    const cx = s.x + 2.5, cy = s.y + s.h * 0.5;
    for (const F of fakeCv) {
      const f = F.f, x0 = f[0] * TS, y0 = f[1] * TS, x1 = x0 + f[2] * TS, y1 = y0 + f[3] * TS;
      const inside = cx > x0 - 8 && cx < x1 + 8 && cy > y0 - 8 && cy < y1 + 8;
      let target = inside ? 0.28 : 1;
      if (f[4] === 'plug') target = s.bBurst ? 0 : 1;
      if (f[4] === 'nocmp') target = s.cmp ? 0 : 1;
      if (f[4] === 'plug' && s.bBurst && F.a > 0.95) crumble(f);
      F.a += (target - F.a) * Math.min(1, dt * (f[4] ? 3 : 6));
      if (F.a < 0.01) continue;
      if (x1 < camX - 10 || x0 > camX + 2000 || y1 < camY - 10 || y0 > camY + 2000) continue;
      ctx.globalAlpha = F.a; ctx.drawImage(F.c, Math.round(x0 - TS - camX), Math.round(y0 - TS - camY)); ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------------ light mask */
  let lc = null, lctx = null, lw = 0, lh = 0, ldata = null, odata = null, ocv = null, octx = null, oimg = null, o32 = null;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const STOPS = [];
  for (let i = 0; i <= 12; i++) { const u = i / 12; STOPS.push([u, 1 - smooth(0.30, 1, u)]); }

  function ensureLight(W, H) {
    if (lw === W && lh === H) return;
    lw = W; lh = H;
    lc = document.createElement('canvas'); lc.width = W; lc.height = H;
    lctx = lc.getContext('2d', { willReadFrequently: true });
    ocv = document.createElement('canvas'); ocv.width = W; ocv.height = H;
    octx = ocv.getContext('2d');
    oimg = octx.createImageData(W, H); o32 = new Uint32Array(oimg.data.buffer);
  }

  function visPoly(w, ox, oy, r, a0, a1, n) {
    const pts = [];
    const step = (a1 - a0) / n;
    for (let i = 0; i <= n; i++) {
      const a = a0 + step * i, dx = Math.cos(a), dy = Math.sin(a);
      const d = D.castRay(w, ox, oy, dx, dy, r);
      pts.push(ox + dx * (d + 0.6), oy + dy * (d + 0.6));
    }
    return pts;
  }

  function radialGrad(ctx, x, y, r, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let i = 0; i < STOPS.length; i++) g.addColorStop(STOPS[i][0], 'rgba(255,255,255,' + (STOPS[i][1] * alpha).toFixed(3) + ')');
    return g;
  }

  function fillPoly(ctx, pts, camX, camY, closeToOrigin, ox, oy) {
    ctx.beginPath();
    if (closeToOrigin) ctx.moveTo(ox - camX, oy - camY);
    for (let i = 0; i < pts.length; i += 2) { if (i === 0 && !closeToOrigin) ctx.moveTo(pts[i] - camX, pts[i + 1] - camY); else ctx.lineTo(pts[i] - camX, pts[i + 1] - camY); }
    ctx.closePath(); ctx.fill();
  }

  function drawHazardLight(ctx, w, l, camX, camY, W, H) {
    const rr = l.reach;
    if (l.x + rr < camX || l.x - rr > camX + W || l.y + rr < camY || l.y - rr > camY + H) return;
    const a = l.I * l.k;
    if (a < 0.004) return;
    if (l.t === 'beam') {
      // per-column rays along the beam direction, drawn as a soft rectangle
      const cols = Math.max(4, Math.ceil(l.w / 1.5));
      const hw = l.w / 2;
      const pts = [];
      const far = [];
      for (let i = 0; i <= cols; i++) {
        const v = -hw + (i / cols) * l.w;
        const sx = l.x + l.nx * v, sy = l.y + l.ny * v;
        const d = D.castRay(w, sx, sy, l.dx, l.dy, l.len);
        pts.push(sx, sy); far.push(sx + l.dx * (d + 0.5), sy + l.dy * (d + 0.5));
      }
      for (let layer = 0; layer < 3; layer++) {
        const shrink = [1, 0.84, 0.62][layer], al = [0.34, 0.33, 0.33][layer] * a;
        const poly = [];
        const lo = Math.round((1 - shrink) / 2 * cols), hi = cols - lo;
        for (let i = lo; i <= hi; i++) poly.push(pts[i * 2], pts[i * 2 + 1]);
        for (let i = hi; i >= lo; i--) poly.push(far[i * 2], far[i * 2 + 1]);
        const g = ctx.createLinearGradient(l.x - camX, l.y - camY, l.x + l.dx * l.len - camX, l.y + l.dy * l.len - camY);
        g.addColorStop(0, 'rgba(255,255,255,' + al.toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,' + (al * 0.55).toFixed(3) + ')');
        ctx.fillStyle = g; fillPoly(ctx, poly, camX, camY, false);
      }
      return;
    }
    if (l.t === 'watch') {
      const n = Math.max(24, Math.round(l.half * 2 * l.r / 5));
      const layers = [[1.0, 0.30], [0.82, 0.34], [0.62, 0.36]];
      for (const [f, al] of layers) {
        const pts = visPoly(w, l.x, l.y, l.r, l.ang - l.half * f, l.ang + l.half * f, n);
        ctx.fillStyle = radialGrad(ctx, l.x - camX, l.y - camY, l.r, al * a);
        fillPoly(ctx, pts, camX, camY, true, l.x, l.y);
      }
      return;
    }
    if (l.t === 'flood') {
      const fy = Math.round(l.fy - camY);
      if (fy <= 0) return;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.95 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, Math.min(H, fy));
      const g = ctx.createLinearGradient(0, fy, 0, fy + 24); g.addColorStop(0, 'rgba(255,255,255,' + (0.9 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, fy, W, 24);
      return;
    }
    if (l.boss) l._poly = null;
    // lamp / orb
    let pts = l._poly;
    if (!pts || l.move) {
      const n = Math.max(40, Math.min(220, Math.round(l.r * 2.4)));
      pts = visPoly(w, l.x, l.y, l.r, 0, Math.PI * 2, n);
      if (!l.move) l._poly = pts;
    }
    ctx.fillStyle = radialGrad(ctx, l.x - camX, l.y - camY, l.r, a);
    fillPoly(ctx, pts, camX, camY, false);
  }

  function softDisc(ctx, x, y, r, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  /* The darkness pass: builds the light mask, dithers it to a few bands, composites a dark overlay. */
  const AMBIENT = 0.34, STEPS = 9;
  function lightPass(ctx, Gm, camX, camY, W, H) {
    const w = Gm.w, s = Gm.s;
    ensureLight(W, H);
    lctx.globalCompositeOperation = 'source-over'; lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'lighter';
    const lights = w.lights;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      if (l.hazard) drawHazardLight(lctx, w, l, camX, camY, W, H);
    }
    // gentle lifts: the Dweller sees a little in the dark; tethers and the crystal glow without hurting
    const px = s.x + 2.5, py = s.y + s.h * 0.5;
    softDisc(lctx, px - camX, py - camY, 26, 0.30);
    for (const c of w.checks) {
      if (c.x < camX - 30 || c.x > camX + W + 30) continue;
      softDisc(lctx, c.x - camX, c.y - 12 - camY, c.i <= s.cp ? 30 : 14, c.i <= s.cp ? 0.42 : 0.16);
    }
    const g = w.goal;
    if (g.x > camX - 140 && g.x < camX + W + 140) softDisc(lctx, g.x - camX, g.y - camY, 110, 0.8);
    for (const l of lights) if (!l.hazard && l.col !== 'rainbow' && l.col !== 'shard') { if (l.x > camX - l.r && l.x < camX + W + l.r) softDisc(lctx, l.x - camX, l.y - camY, l.r, 0.5 * l.k); }
    // the hidden seeker leaks a little light through its false wall; the companion glows softly
    if (w.secret && !s.cmp) softDisc(lctx, w.secret.x - camX, w.secret.y - camY, 22, 0.22);
    if (s.cmp) softDisc(lctx, s.cmpX - camX, s.cmpY - camY, 14, 0.18);
    // quantize
    const darkBGR = (TH.dark[2] << 16) | (TH.dark[1] << 8) | TH.dark[0];
    const id = lctx.getImageData(0, 0, W, H); const d = id.data;
    const dark = (0xFF << 24) | (16 << 16) | (8 << 8) | 5;      // ABGR: r=5 g=8 b=16
    let o = 0;
    for (let y = 0; y < H; y++) {
      const by = (y & 3) * 4;
      for (let x = 0; x < W; x++, o++) {
        const i = o * 4;
        let L = d[i]; if (d[i + 1] > L) L = d[i + 1]; if (d[i + 2] > L) L = d[i + 2];
        let q = Math.floor(L / 255 * STEPS + (BAYER[by + (x & 3)] + 0.5) / 16) / STEPS;
        if (q > 1) q = 1;
        const a = 1 - (AMBIENT + (1 - AMBIENT) * q);
        o32[o] = ((a * 250) << 24) | darkBGR; // alpha + theme dark colour (ABGR)
      }
    }
    octx.putImageData(oimg, 0, 0);
    ctx.drawImage(ocv, 0, 0);
  }

  /* ------------------------------------------------------------------ sprites in the world */
  /* Frame choice follows The Seeker's own .anim.toml scripts (12 fps, 8 ticks a frame):
   * idle has a left row (flipped) and a right row, each with a landing crouch and a loop;
   * run starts on its second frame (first after a fall or a turn) and loops 3..10;
   * fall has a straight and a sideways version that swap frame for frame. */
  function playerFrame(s) {
    const f = Math.floor(s.anim / 8);
    const loop = (i, start, a, b) => { i += start; return i <= b ? i : a + (i - a) % (b - a + 1); };
    switch (s.st) {
      case 'idle': {
        // a landing crouch (two frames) first, then the breathing pose, the same either way it faces
        const land = s.fromSt === 'fall' || s.fromSt === 'jump' || s.fromSt === 'wall';
        if (land && f < 2) return ['idle', f];
        return ['breath', BREATH[(f - (land ? 2 : 0)) % BREATH.length]];
      }
      case 'run': {
        const turned = s.t - s.faceT <= s.anim;
        const a = turned ? s.t - s.faceT : s.anim;
        const start = turned || s.fromSt === 'fall' ? 0 : 1;
        return ['run', loop(Math.floor(a / 8), start, 2, 9)];
      }
      // frame 1 once, then 2-5 loop; frames 6-12 belong to the double jump
      case 'jump': return ['jump', loop(f, 0, 1, 4)];
      // falling straight: 1-2 lead in, 3-6 loop; drifting sideways: the same phase in frames 7-12
      case 'fall': return ['fall', loop(f, 0, 2, 5) + (Math.abs(s.vx) > 12 ? 6 : 0)];
      // a roll plays once and holds; crawling loops it
      case 'roll': return ['roll', s.roll > 0 ? Math.min(3, f) : f % 4];
      case 'wall': return ['wall', f % 3];
      case 'climb': return ['wall', Math.abs(s.vy) > 1 ? f % 3 : 0];
      case 'death': return ['death', Math.min(6, f)];
    }
    return ['breath', 0];
  }

  let sceneTime = 0;
  function drawPlayer(ctx, s, camX, camY, pass, flash) {
    const [name, idx] = playerFrame(s);
    const sh = SHEETS[pass === 'visor' ? name + 'V' : name];
    let fx = Math.round(s.x + 2.5 - camX); const fy = Math.round(s.y + s.h - camY);
    // on a strand you sway with it, the way the vine is drawn swaying
    if (s.st === 'climb' && TH.style !== 'foundry' && TH.style !== 'ember') fx += Math.round(Math.sin(sceneTime * 1.2 + (s.y + 3) * 0.09) * 1.2);
    const flip = s.st === 'wall' ? s.wdir < 0 : s.st === 'climb' ? s.face > 0 : s.face < 0;
    drawFrame(ctx, sh, idx, fx, fy, flip);
    if (pass === 'body' && flash > 0.02) {
      // white-hot flash while burning: draw the sprite again as a white silhouette
      ctx.globalAlpha = Math.min(0.85, flash);
      ctx.globalCompositeOperation = 'lighter';
      drawFrame(ctx, SHEETS[name], idx, fx, fy, flip);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }

  function drawTether(ctx, c, s, camX, camY, time) {
    const sh = SHEETS.tether;
    const active = c.i <= s.cp;
    let idx;
    if (!active) idx = 0 + Math.floor(time * 3) % 2 * 0;
    else {
      const t = (Gm_timeSince(c.i) || 99);
      idx = t < 6 * 0.083 * 3 ? 2 + Math.floor(t / (0.083 * 3)) : 8 + Math.floor(time * 12) % 16;
    }
    drawFrame(ctx, sh, idx, Math.round(c.x - camX), Math.round(c.y - camY), false);
  }
  let tetherT = {};
  function Gm_timeSince(i) { return tetherT[i]; }
  function markTether(i, time) { tetherT[i] = 0; tetherT['_' + i] = time; }
  function tickTethers(dt) { for (const k in tetherT) if (k[0] !== '_') tetherT[k] += dt; }

  /* how many open tiles lie straight above / below a tile (capped) */
  function openUp(w, tx, ty, lim) { let k = 0; while (k < lim && !D.solidAt(w, tx, ty - k - 1)) k++; return k; }
  function openDown(w, tx, ty, lim) { let k = 0; while (k < lim && !D.solidAt(w, tx, ty + k + 1)) k++; return k; }
  /* a cord from the underside of the rock above (x, y) down to y - gap, drawn into the rock a pixel so it never floats */
  function drawCord(ctx, w, wx, wy, camX, camY, gap, lit) {
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS), top = openUp(w, tx, ty, 90);
    if (top >= 90) return false;
    const x = Math.round(wx - camX), y0 = Math.round((ty - top) * TS - camY) - 1, y1 = Math.round(wy - camY) - gap;
    if (y1 <= y0) return true;
    ctx.fillStyle = lit ? TH.stal[1] : TH.near; ctx.fillRect(x, y0, 1, y1 - y0);
    ctx.fillStyle = lit ? TH.stal[0] : TH.far[0]; ctx.fillRect(x + 1, y0, 1, Math.max(0, y1 - y0 - 1));
    ctx.fillStyle = lit ? TH.stal[1] : TH.near; ctx.fillRect(x - 1, y0, 4, 2);           // where it is fixed into the rock
    return true;
  }

  function drawLampCrystal(ctx, w, l, camX, camY, time, post) {
    const x = Math.round(l.x - camX), y = Math.round(l.y - camY);
    const k = Math.max(0.15, l.k);
    if (l.col === 'cap') {                       // a breathing glowcap on its stalk
      if (!post) {
        const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS), dn = openDown(w, tx, ty, 8);
        if (dn < 8) {                            // a cap on a stalk from the floor
          ctx.fillStyle = TH.near; ctx.fillRect(x - 1, y, 3, (dn + 1) * TS - (l.y - ty * TS) + 1);
          ctx.fillStyle = TH.mid; ctx.fillRect(x, y, 1, (dn + 1) * TS - (l.y - ty * TS));
        } else drawCord(ctx, w, l.x, l.y, camX, camY, 2);   // a cap hanging from the roof on its thread
        return;
      }
      const g = Math.min(1, l.k * 1.4);
      ctx.fillStyle = TH.lamp[0]; ctx.fillRect(x - 4, y - 1, 9, 2); ctx.fillRect(x - 3, y - 2, 7, 1); ctx.fillRect(x - 2, y - 3, 5, 1);
      ctx.globalAlpha = 0.25 + 0.75 * g;
      ctx.fillStyle = TH.lamp[1]; ctx.fillRect(x - 3, y - 1, 7, 1); ctx.fillRect(x - 2, y - 2, 5, 1);
      ctx.fillStyle = TH.lamp[2]; ctx.fillRect(x - 1, y - 3, 2, 1); ctx.fillRect(x - 2, y - 2, 1, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = TH.near; ctx.fillRect(x - 4, y + 1, 9, 1);
      return;
    }
    if (!post) {
      // hung from the roof on a cord; a lamp low over a floor under a far roof stands on a post instead
      const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS), top = openUp(w, tx, ty, 90), dn = openDown(w, tx, ty, 8);
      let side = 0, sd = 9;
      for (let k = 0; k < 6; k++) { if (D.solidAt(w, tx - k - 1, ty)) { side = -1; sd = k; break; } if (D.solidAt(w, tx + k + 1, ty)) { side = 1; sd = k; break; } }
      if (top > 12 && side !== 0) {               // a bracket from the nearest wall
        const wx = side < 0 ? Math.round((tx - sd) * TS - camX) - 1 : Math.round((tx + sd + 1) * TS - camX) + 1;
        const xa = Math.min(wx, x), xb = Math.max(wx, x);
        ctx.fillStyle = TH.near; ctx.fillRect(xa, y - 5, xb - xa + 1, 2); ctx.fillRect(x, y - 5, 1, 3);
        ctx.fillStyle = TH.mid; ctx.fillRect(xa, y - 5, xb - xa + 1, 1);
        ctx.fillStyle = TH.near; ctx.fillRect(side < 0 ? wx - 1 : wx - 1, y - 7, 2, 6);
      } else if (top < 90 && !(top > 30 && dn < 6)) drawCord(ctx, w, l.x, l.y, camX, camY, 2);
      else if (dn < 8) {
        const fy = Math.round((ty + dn + 1) * TS - camY);
        ctx.fillStyle = TH.near; ctx.fillRect(x - 1, y + 2, 3, fy - y - 2); ctx.fillRect(x - 3, fy - 2, 7, 2);
        ctx.fillStyle = TH.mid; ctx.fillRect(x, y + 2, 1, fy - y - 4); ctx.fillRect(x - 2, fy - 2, 5, 1);
      }
      return;
    }
    // crystal body (drawn after the dark pass: it is the light)
    const f = 0.75 + 0.25 * k;
    ctx.fillStyle = TH.lamp[0]; ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = TH.lamp[1]; ctx.fillRect(x - 1, y - 3, 3, 6);
    ctx.fillStyle = TH.lamp[2]; ctx.fillRect(x - 1, y - 2, 2, 4);
    ctx.globalAlpha = f; ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2, 1, 2); ctx.globalAlpha = 1;
  }

  function drawOrb(ctx, l, camX, camY, time, w) {
    if (w && D.solidAt(w, Math.floor(l.x / TS), Math.floor(l.y / TS))) return;   // passing behind the rock
    const x = Math.round(l.x - camX), y = Math.round(l.y - camY);
    drawFrame(ctx, SHEETS.orbT || SHEETS.orb, Math.floor(time * 12 + l.id) % 8, x, y, false);
  }

  function drawWatcher(ctx, l, camX, camY, time, post, caught, S, w) {
    const x = Math.round(l.x - camX), y = Math.round(l.y - camY);
    if (!post) {
      // an eye with no rock beside it hangs from the roof
      const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS);
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (D.solidAt(w, tx + dx, ty + dy)) { near = true; break; }
      if (!near && w) drawCord(ctx, w, l.x, l.y, camX, camY, 5);
      drawFrame(ctx, SHEETS.voidBody, 0, x, y, false);
      return;
    }
    if (w) {
      const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS);
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (D.solidAt(w, tx + dx, ty + dy)) { near = true; break; }
      if (!near) { ctx.globalAlpha = 0.7; drawCord(ctx, w, l.x, l.y, camX, camY, 5, true); ctx.globalAlpha = 1; }
    }
    const sh = SHEETS.eye;
    drawFrame(ctx, sh, 0, x, y, false);
    // the pupil follows the beam; when the beam finds the Seeker it snaps onto them and burns
    let ang = l.ang, hot = 0;
    if (caught > 0 && S) { ang = Math.atan2(S.y + S.h * 0.5 - l.y, S.x + 2.5 - l.x); hot = Math.min(1, caught); }
    const px = x + Math.round(Math.cos(ang) * 3), py = y + Math.round(Math.sin(ang) * 3);
    if (hot > 0) {
      const pulse = 0.75 + 0.25 * Math.sin(time * 40);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(px, py, 0, px, py, 14);
      gr.addColorStop(0, 'rgba(255,235,200,' + (0.75 * hot * pulse).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = gr; ctx.fillRect(px - 14, py - 14, 28, 28);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff'; ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = '#ffe6bd'; ctx.fillRect(px - 1, py - 1, 3, 3);
      return;
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(px - 1, py - 1, 3, 3);
    ctx.globalAlpha = 0.6; ctx.fillStyle = TH.pupil; ctx.fillRect(px - 2, py - 1, 5, 3); ctx.globalAlpha = 1;
  }

  function drawBeamEmitter(ctx, l, camX, camY, time) {
    const k = l.k;
    const cx = l.x - camX, cy = l.y - camY;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    // slit glows according to gain
    const a = 0.25 + 0.75 * Math.min(1, k * 4);
    ctx.globalAlpha = a;
    ctx.fillStyle = k > 0.5 ? '#fff' : TH.slit;
    const axis = Math.abs(l.dx) < 0.05 || Math.abs(l.dy) < 0.05;
    if (!axis) ctx.rotate(Math.atan2(l.dy, l.dx) - Math.PI / 2);
    if (!axis || Math.abs(l.dx) < 0.5) ctx.fillRect(-Math.round(l.w / 2), -1, Math.round(l.w), 2);
    else ctx.fillRect(-1, -Math.round(l.w / 2), 2, Math.round(l.w));
    ctx.restore(); ctx.globalAlpha = 1;
  }

  /* The prismatic crystal: faceted, each facet drifting through the spectrum. */
  function hsl(h, s, l, a) { return 'hsla(' + Math.round(h % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; }
  function drawCrystal(ctx, g, camX, camY, time, burst) {
    const x = Math.round(g.x - camX), y = Math.round(g.y - camY) + Math.round(Math.sin(time * 2.1) * 1.5);
    const pts = [[0, -11], [5, -3], [4, 7], [0, 10], [-4, 7], [-5, -3]];
    const facets = [[0, 1, 3], [0, 3, 5], [0, 5, 4], [1, 2, 3], [3, 4, 5], [4, 5, 0]];
    const base = time * 60;
    const sc = burst ? 1 + burst * 0.6 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    const tri = [[[0, -11], [5, -3], [0, 1]], [[0, -11], [0, 1], [-5, -3]], [[5, -3], [4, 7], [0, 1]], [[-5, -3], [0, 1], [-4, 7]], [[0, 1], [4, 7], [0, 10]], [[0, 1], [0, 10], [-4, 7]]];
    tri.forEach((t, i) => {
      ctx.fillStyle = hsl(base + i * 58, 60, 62 + (i % 2) * 12);
      ctx.beginPath(); ctx.moveTo(Math.round(t[0][0]), Math.round(t[0][1])); ctx.lineTo(Math.round(t[1][0]), Math.round(t[1][1])); ctx.lineTo(Math.round(t[2][0]), Math.round(t[2][1])); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-2, -8, 1, 3); ctx.fillRect(1, -5, 1, 1);
    ctx.restore();
  }

  /* ------------------------------------------------------------------ the SEEKER companion
   * A tiny monitor-robot in the colours of whichever SEEKER NET seeker woke, redrawn at the Dweller's scale. */
  const MINI = [
    '.....r.....',
    '.....a.....',
    '..LLLLLLL..',
    '.LBBBBBBBS.',
    '.BKKKKKKBS.',
    '.BKKKKKKBS.',
    '.BKKKKKKBS.',
    '.BBBBBBBBS.',
    '.BgBBBBgBS.',
    '..SSSSSSS..',
  ];
  const MINI_KB = '..kkkkkkk..';
  const MINI_COL = { r: '#a2324e', a: '#485f67', L: '#8ea6db', B: '#6c78a2', S: '#30446c', K: '#000000', g: '#5daa99', k: '#c59154', d: '#905937' };
  /* the ten seekers that can wake in the mycelium: each mini takes its colours from the seeker's colorway */
  const SEEKERS = (global.DWELLER_SEEKERS || [{ id: 1895 }]);
  let seekerId = SEEKERS[0].id;
  function miniColours(m) {
    if (!m || !m.cw || m.id === 1895) return MINI_COL;
    const c = m.cw;
    return { r: c.X, a: '#485f67', L: shade(c.B, 0.3), B: c.B, S: c.D, K: '#000000', g: c.T, k: c.P, d: c.D };
  }
  let MCOL = MINI_COL;
  function miniCanvas(dormant) {
    const c = document.createElement('canvas'); c.width = 11; c.height = 13;
    const x = c.getContext('2d');
    const rows = MINI.concat(['...........', MINI_KB, '...dddddd..']);
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; x.fillStyle = MCOL[ch]; x.fillRect(i, j, 1, 1); } });
    if (dormant) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(6,8,14,0.55)'; x.fillRect(0, 0, 11, 13); }
    return c;
  }
  function buildSeekerSprites() {
    setSeeker(seekerId);
  }
  function setSeeker(id) {
    const m = SEEKERS.find(q => q.id === id) || SEEKERS[0];
    seekerId = m.id; MCOL = miniColours(m);
    SHEETS.mini = miniCanvas(false); SHEETS.miniOff = miniCanvas(true);
  }
  /* draws the companion; mode: 'on' (eyes), 'off' (dormant battery), 'cool' (recharging bar) */
  function drawMini(ctx, x, y, time, mode, face, k) {
    x = Math.round(x); y = Math.round(y);
    const bob = Math.round(Math.sin(time * 3.1) * 0.8), kb = Math.round(Math.sin(time * 3.1 + 1.2) * 1);
    const cv = mode === 'off' ? SHEETS.miniOff : SHEETS.mini;
    const flip = face < 0;
    ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(cv, 0, 0, 11, 10, -5, -6 + bob, 11, 10);
    ctx.drawImage(cv, 0, 11, 11, 2, -5, 5 + kb, 11, 2);
    // the screen: 6 x 3 at (2,4)
    const sx = -3, sy = -2 + bob;
    if (mode === 'off') {
      const on = Math.floor(time * 1.5) % 2 === 0;
      ctx.fillStyle = on ? '#a2324e' : '#3a1420'; ctx.fillRect(sx + 1, sy + 1, 3, 1); ctx.fillRect(sx + 4, sy + 1, 1, 1);
    } else if (mode === 'cool') {
      ctx.fillStyle = '#1b3a40'; ctx.fillRect(sx + 1, sy + 1, 4, 1);
      ctx.fillStyle = '#5daa99'; ctx.fillRect(sx + 1, sy + 1, Math.max(0, Math.round(4 * (k || 0))), 1);
    } else {
      const blink = (time % 3.7) < 0.12;
      ctx.fillStyle = '#ffffff';
      if (blink) { ctx.fillRect(sx + 1, sy + 1, 1, 1); ctx.fillRect(sx + 4, sy + 1, 1, 1); }
      else { ctx.fillRect(sx + 1, sy, 1, 2); ctx.fillRect(sx + 4, sy, 1, 2); ctx.fillStyle = '#d5f8fc'; ctx.fillRect(sx + 2, sy, 1, 1); ctx.fillRect(sx + 5, sy, 1, 1); }
    }
    ctx.restore();
  }
  /* the unlock card: the real SEEKER NET art */
  function drawPortrait(ctx, x, y, scale, alpha) {
    const im = IMG['seeker' + seekerId] || IMG.seeker1895; if (!im) return;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(im, Math.round(x - 27 * scale), Math.round(y - 27 * scale), 54 * scale, 54 * scale);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ the crystal and its six slivers
   * The whole crystal is a hexagonal gem cut into six vertical slivers. Each level holds one. */
  const GEM = [[0, -15], [9, -5], [8, 7], [0, 15], [-8, 7], [-9, -5]];
  function gemPath(ctx, s) { ctx.beginPath(); GEM.forEach((p, i) => { const X = p[0] * s, Y = p[1] * s; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath(); }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const m = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  /* the whole gem; have[i] says which slivers are in. ghost: draw missing ones as faint outlines */
  function drawGem(ctx, x, y, s, have, time, glow) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    const sw = 18 / 6;
    for (let i = 0; i < 6; i++) {
      ctx.save(); gemPath(ctx, s); ctx.clip();
      const x0 = (-9 + i * sw) * s;
      if (have[i]) {
        const c = SHARDS[i];
        ctx.fillStyle = shade(c, 0.05); ctx.fillRect(x0, -16 * s, sw * s, 32 * s);
        ctx.fillStyle = shade(c, 0.35); ctx.fillRect(x0, -16 * s, sw * s, 11 * s);
        ctx.fillStyle = shade(c, -0.3); ctx.fillRect(x0, 7 * s, sw * s, 9 * s);
        const tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
        ctx.globalAlpha = 0.35 * tw; ctx.fillStyle = '#fff'; ctx.fillRect(x0, -16 * s + ((time * 6 + i * 5) % 32) * s, sw * s, 1); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(30,32,44,0.9)'; ctx.fillRect(x0, -16 * s, sw * s, 32 * s);
      }
      ctx.restore();
    }
    ctx.strokeStyle = glow ? 'rgba(255,255,255,0.55)' : 'rgba(120,128,150,0.5)'; ctx.lineWidth = 1; gemPath(ctx, s); ctx.stroke();
    ctx.fillStyle = 'rgba(10,10,16,0.7)';
    for (let i = 1; i < 6; i++) ctx.fillRect(Math.round((-9 + i * sw) * s), -16 * s, 1, 32 * s);
    ctx.restore();
  }
  /* one sliver, as it hangs at the end of a level */
  function drawShard(ctx, x, y, col, time, burst, s) {
    s = (s || 1) * (burst ? 1 + burst * 0.5 : 1);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(s, s);
    const P = [[0, -13], [3, -6], [3, 7], [0, 13], [-3, 7], [-3, -6]];
    ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = shade(col, 0); ctx.fill();
    ctx.fillStyle = shade(col, 0.45); ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(3, -6); ctx.lineTo(0, -2); ctx.lineTo(-3, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(col, -0.35); ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(3, 7); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(col, 0.2); ctx.fillRect(-3, -6, 1, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-1, -9, 1, 4); ctx.fillRect(1, -4, 1, 1);
    const sp = (time * 0.7) % 1; ctx.globalAlpha = 0.6 * (1 - sp); ctx.fillStyle = '#fff'; ctx.fillRect(-3, Math.round(-12 + sp * 24), 6, 1); ctx.globalAlpha = 1;
    ctx.restore();
  }
  function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  /* ------------------------------------------------------------------ particles */
  const parts = [];
  function spawn(x, y, vx, vy, life, col, size, grav, add) { if (parts.length < 600) parts.push({ x, y, vx, vy, life, max: life, col, size: size || 1, grav: grav || 0, add: !!add }); }
  function updateParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function drawParticles(ctx, camX, camY) {
    for (const p of parts) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ the Guardian (#255 of the Planetary Guardians) */
  const GS = 2;                                         // drawn at twice its 54 px
  const gRot = new Map();
  function guardianBody(ang) {
    // rotate the 54 px body on its own pixel grid (nearest neighbour), cached per degree
    const key = Math.round(((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 90));
    let c = gRot.get(key);
    if (c) return c;
    const src = IMG.g255_body; if (!src) return null;
    if (!guardianBody.px) guardianBody.px = src.getContext('2d').getImageData(0, 0, 54, 54).data;
    const sp = guardianBody.px, N = 76, a = key * Math.PI / 90, ca = Math.cos(a), sa = Math.sin(a);
    c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d'), id = x.createImageData(N, N), d = id.data;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i - N / 2 + 0.5, v = j - N / 2 + 0.5;
      const sx = Math.floor(ca * u + sa * v + 27), sy = Math.floor(-sa * u + ca * v + 27);
      if (sx < 0 || sy < 0 || sx >= 54 || sy >= 54) continue;
      const o = (sy * 54 + sx) * 4, q = (j * N + i) * 4;
      d[q] = sp[o]; d[q + 1] = sp[o + 1]; d[q + 2] = sp[o + 2]; d[q + 3] = sp[o + 3];
    }
    x.putImageData(id, 0, 0);
    if (gRot.size > 200) gRot.clear();
    gRot.set(key, c); return c;
  }
  function drawGuardian(ctx, w, s, camX, camY, time) {
    const B = w.boss; if (!B || s.bBurst) return;
    const gx = Math.round(B.x - camX), gy = Math.round(B.y - camY);
    const shake = s.bDie ? Math.round(Math.sin(time * 70) * 2) : 0;
    ctx.imageSmoothingEnabled = false;
    if (IMG.g255_orb) ctx.drawImage(IMG.g255_orb, gx - 27 * GS + shake, gy - 27 * GS, 54 * GS, 54 * GS);
    const body = guardianBody(s.bAng || 0);
    if (body) ctx.drawImage(body, gx - 38 * GS + shake, gy - 38 * GS, 76 * GS, 76 * GS);
    // the eye: shut while it sleeps, dimmed under the SEEKER, white-hot as it flares
    if (IMG.g255_eyes) {
      const ecl = s.cmpL >= 0 && w.lights[s.cmpL] && w.lights[s.cmpL].boss && s.cmpK > 0;
      ctx.globalAlpha = !s.bWake ? 0.18 : ecl ? 0.25 : 1;
      ctx.drawImage(IMG.g255_eyes, gx - 27 * GS + shake, gy - 27 * GS, 54 * GS, 54 * GS);
      if (B.flare.k > 0.2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = B.flare.k; ctx.drawImage(IMG.g255_eyes, gx - 27 * GS, gy - 27 * GS, 54 * GS, 54 * GS); ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalAlpha = 1;
    }
  }
  // the burst: every pixel of the Guardian flies apart
  const gBits = [];
  function guardianBurst(w, s) {
    const B = w.boss; if (!B) return;
    const layers = [IMG.g255_orb, guardianBody(s.bAng || 0), IMG.g255_eyes];
    layers.forEach((cv, li) => {
      if (!cv) return;
      const n = cv.width, d = cv.getContext('2d').getImageData(0, 0, n, n).data;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const o = (j * n + i) * 4; if (d[o + 3] < 128) continue;
        const px = B.x + (i - n / 2 + 0.5) * GS, py = B.y + (j - n / 2 + 0.5) * GS;
        const dx = px - B.x, dy = py - B.y, r = Math.hypot(dx, dy) || 1, sp = 40 + Math.random() * 160 + (li === 2 ? 120 : 0);
        gBits.push({ x: px, y: py, vx: dx / r * sp + (Math.random() - 0.5) * 40, vy: dy / r * sp + (Math.random() - 0.5) * 40 - 30,
          life: 1.6 + Math.random() * 2.2, max: 3.8, col: 'rgb(' + d[o] + ',' + d[o + 1] + ',' + d[o + 2] + ')', hot: li === 2 || Math.random() < 0.25 });
      }
    });
  }
  function drawGuardianBits(ctx, camX, camY, dt) {
    if (!gBits.length) return;
    for (let i = gBits.length - 1; i >= 0; i--) {
      const p = gBits[i];
      p.vy += 60 * dt; p.vx *= 1 - 0.6 * dt; p.vy *= 1 - 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { gBits.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life / 1.2);
      ctx.fillStyle = p.hot && p.life > p.max - 1.0 ? '#ffffff' : p.col;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), GS, GS);
    }
    ctx.globalAlpha = 1;
  }
  // the six alcoves
  function drawAlcoves(ctx, w, s, camX, camY, time, post) {
    const B = w.boss; if (!B) return;
    for (let i = 0; i < B.alc.length; i++) {
      const A = B.alc[i], x = Math.round(A.x - camX), y = Math.round(A.y - camY);
      const done = i < (s.bP || 0), next = i === (s.bP || 0) && s.bWake;
      if (!post) {
        // a socket of dark stone with a notch for the sliver
        ctx.fillStyle = TH.near; ctx.fillRect(x - 5, y - 4, 11, 4); ctx.fillRect(x - 3, y - 6, 7, 2);
        ctx.fillStyle = TH.stal[1]; ctx.fillRect(x - 5, y - 4, 11, 1); ctx.fillRect(x - 1, y - 6, 3, 1);
        continue;
      }
      const col = SHARDS[i];
      if (done) {
        const hov = Math.round(Math.sin(time * 2 + i) * 1);
        drawShard(ctx, x, y - 13 + hov, col, time, 0, 0.55);
      } else if (next) {
        const pu = 0.5 + 0.5 * Math.sin(time * 5);
        if (s.bSet > 0) {             // setting: the sliver grows out of the socket
          const k = Math.min(1, s.bSet / D.GB.SET);
          ctx.globalAlpha = 0.4 + 0.6 * k; drawShard(ctx, x, y - 13, col, time, 0, 0.2 + 0.35 * k); ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = 0.35 + 0.5 * pu; ctx.fillStyle = col;
        ctx.fillRect(x - 6, y - 5, 1, 1); ctx.fillRect(x + 6, y - 5, 1, 1); ctx.fillRect(x - 1, y - 9 - Math.round(pu * 2), 3, 1);
        ctx.fillRect(x, y - 7, 1, 1);
        // a thread of its colour rising, so it can be found from across the arena
        ctx.globalAlpha = 0.18 + 0.12 * pu; ctx.fillRect(x, y - 40, 1, 32);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.fillRect(x, y - 6, 1, 1); ctx.globalAlpha = 1;
      }
    }
  }

  /* ------------------------------------------------------------------ the whole scene */
  function drawBackground(ctx, w, camX, camY, W, H, time) {
    // depth tint: cold at the top, violet-teal in the deep
    const depth = Math.max(0, Math.min(1, (camY + H / 2) / (w.H * TS)));
    const top = TH.bgTop, bot = TH.bgBot;
    const r = Math.round(top[0] + (bot[0] - top[0]) * depth), g = Math.round(top[1] + (bot[1] - top[1]) * depth), b = Math.round(top[2] + (bot[2] - top[2]) * depth);
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')'; ctx.fillRect(0, 0, W, H);
    const par = [0.12, 0.28, 0.5];
    for (let i = 0; i < 3; i++) {
      const L = bgLayers[i];
      const ox = -((camX * par[i]) % 512 + 512) % 512;
      const oy = Math.round(-(camY * par[i]) % 400) + (i === 0 ? 20 : i === 1 ? 0 : -10);
      for (let rx = ox - 512; rx < W; rx += 512) {
        if (rx + 512 < 0) continue;
        for (let ry = oy - 300; ry < H; ry += 300) { if (ry + 300 < 0) continue; ctx.drawImage(L, Math.round(rx), Math.round(ry)); }
      }
    }
  }

  function drawTerrain(ctx, w, camX, camY, W, H) {
    const cx0 = Math.floor(camX / (CH * TS)), cx1 = Math.floor((camX + W) / (CH * TS));
    const cy0 = Math.floor(camY / (CH * TS)), cy1 = Math.floor((camY + H) / (CH * TS));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0) continue;
      ctx.drawImage(chunkCanvas(w, cx, cy), cx * CH * TS - camX, cy * CH * TS - camY);
    }
  }

  function drawDecorBack(ctx, w, camX, camY, W, H, time) {
    const x0 = Math.floor(camX / TS) - 2, x1 = Math.floor((camX + W) / TS) + 2;
    // frost tufts: use pale ice-prop frames from the tileset-free procedural shapes
    for (const f of decor.floor) {
      if (f.x < x0 || f.x > x1) continue;
      const px = f.x * TS - camX, py = (f.y + 1) * TS - camY;
      if (py < -10 || py > H + 10) continue;
      floorProp(ctx, px, py, f, time);
    }
    for (const gl of decor.glow) {
      if (gl.x < x0 * TS || gl.x > x1 * TS) continue;
      ctx.fillStyle = TH.glow; ctx.fillRect(Math.round(gl.x - camX), Math.round(gl.y - camY), 1, 1);
    }
  }

  function floorProp(ctx, px, py, f, time) {
    const a = TH.tuft[0], b = TH.tuft[1], st = TH.style;
    if (st === 'fungal') {                       // tiny mushrooms
      const h = 2 + (f.k % 3);
      ctx.fillStyle = a; ctx.fillRect(px + 2, py - h, 1, h);
      ctx.fillStyle = f.v > 0.6 ? b : a; ctx.fillRect(px + 1, py - h - 1, 3, 1); if (f.k > 2) ctx.fillRect(px, py - h, 1, 1), ctx.fillRect(px + 4, py - h, 1, 1);
    } else if (st === 'glass') {                 // crystal spikes
      ctx.fillStyle = a; ctx.fillRect(px + 2, py - 4, 1, 4); ctx.fillRect(px + 1, py - 2, 1, 2); ctx.fillRect(px + 4, py - 3, 1, 3);
      ctx.fillStyle = b; ctx.fillRect(px + 2, py - 4, 1, 1); ctx.fillRect(px + 4, py - 3, 1, 1);
    } else if (st === 'foundry') {               // bolts and scrap
      ctx.fillStyle = a; ctx.fillRect(px + 1, py - 2, 3, 2); ctx.fillStyle = b; ctx.fillRect(px + 2, py - 2, 1, 1);
      if (f.k > 3) { ctx.fillStyle = a; ctx.fillRect(px + 4, py - 1, 2, 1); }
    } else if (st === 'ember') {                 // glowing cracks
      ctx.fillStyle = a; ctx.fillRect(px, py - 1, 4, 1);
      const on = 0.5 + 0.5 * Math.sin(time * 2 + f.x * 1.7);
      ctx.globalAlpha = 0.4 + 0.6 * on; ctx.fillStyle = b; ctx.fillRect(px + 1 + (f.k % 2), py - 1, 1, 1); ctx.globalAlpha = 1;
    } else if (st === 'heart') {                 // tendrils
      const sway = Math.round(Math.sin(time * 1.4 + f.x) * 1);
      ctx.fillStyle = a; ctx.fillRect(px + 2, py - 2, 1, 2); ctx.fillRect(px + 2 + sway, py - 4, 1, 2);
      ctx.fillStyle = b; ctx.fillRect(px + 2 + sway, py - 5, 1, 1);
    } else {
      ctx.fillStyle = a;
      ctx.fillRect(px + 2, py - 2, 1, 2); ctx.fillRect(px + 1, py - 1, 1, 1); ctx.fillRect(px + 3, py - 3, 1, 3);
      ctx.fillStyle = b; ctx.fillRect(px + 3, py - 3, 1, 1); ctx.fillRect(px + 2, py - 2, 1, 1);
    }
  }

  /* ------------------------------------------------------------------ terrain features
   * shelves (one-way), bounce caps, slick glass, vines, vents and hush stones, each drawn in the level's style */
  let bounceFx = [];
  function noteBounce(x, y, t) { bounceFx.push({ x, y, t }); if (bounceFx.length > 8) bounceFx.shift(); }
  function drawFeatures(ctx, w, s, camX, camY, W, H, time, post) {
    const L = w.level, st = TH.style, T = L.tiles || {};
    const vis = (x, y, ww, hh) => x + ww >= camX - 8 && x <= camX + W + 8 && y + hh >= camY - 8 && y <= camY + H + 8;
    const c0 = TH.lamp[0], c1 = TH.lamp[1], c2 = TH.lamp[2], dk = TH.near, md = TH.mid;
    if (!post) {
      // vines
      for (const v of L.vines || []) {
        // every strand reaches up to the rock it grows from (drawn only: the climbable part is the vine itself)
        if (!v.ext) { v.ext = []; for (let k = 0; k < v[2]; k++) { const u = openUp(w, v[0] + k, v[1], 90); v.ext.push(u >= 90 ? 0 : u * TS + 1); } }
        const x0 = v[0] * TS, y0 = v[1] * TS, hh = v[3] * TS, exM = Math.max.apply(null, v.ext);
        if (!vis(x0, y0 - exM, TS * v[2], hh + exM)) continue;
        for (let k = 0; k < v[2]; k++) {
          const cx = Math.round(x0 + k * TS + 3 - camX);
          for (let y = -v.ext[k]; y < hh; y++) {
            const yy = Math.round(y0 + y - camY), sw = Math.round(Math.sin(time * 1.2 + (y0 + y) * 0.09 + k) * 1.2);
            if (st === 'foundry' || st === 'ember') { ctx.fillStyle = (y >> 1) % 2 ? md : TH.stal[1]; ctx.fillRect(cx + ((y >> 2) % 2 ? 0 : -1), yy, 2, 1); continue; }
            ctx.fillStyle = st === 'heart' ? TH.tuft[0] : st === 'glass' ? TH.stal[1] : st === 'fungal' ? TH.tuft[0] : TH.stal[1];
            ctx.fillRect(cx + sw, yy, 1, 1);
            const m14 = ((y % 14) + 14) % 14; if (m14 % 7 === 3) { ctx.fillStyle = st === 'glass' ? c1 : TH.tuft[1]; ctx.fillRect(cx + sw + (m14 === 3 ? 1 : -1), yy, 1, 1); }
          }
        }
      }
      // shelves
      if (!L._shelfTies) {
        // a shelf with no wall at either end hangs from what is above it: the roof, or the shelf over it
        const ow = new Set(); for (const r of T.oneway || []) for (let k = 0; k < r[2]; k++) ow.add((r[0] + k) + ',' + r[1]);
        L._shelfTies = [];
        for (const r of T.oneway || []) {
          if (D.solidAt(w, r[0] - 1, r[1]) || D.solidAt(w, r[0] + r[2], r[1])) continue;
          for (const cx of r[2] >= 6 ? [r[0] + 1, r[0] + r[2] - 2] : [r[0] + (r[2] >> 1)]) {
            let up = 0; while (up < 60 && !D.solidAt(w, cx, r[1] - up - 1) && !ow.has(cx + ',' + (r[1] - up - 1))) up++;
            if (up > 0 && up < 60) L._shelfTies.push([cx, r[1] - up, up]);
          }
        }
      }
      for (const q of L._shelfTies) {
        const x = Math.round(q[0] * TS + 2 - camX), yt = q[1] * TS - 1, hh = q[2] * TS + 1;
        if (!vis(q[0] * TS, yt, TS, hh)) continue;
        const y = Math.round(yt - camY);
        if (st === 'foundry' || st === 'ember') {      // chains
          for (let i = 0; i < hh; i += 3) { ctx.fillStyle = (i / 3) % 2 ? md : TH.stal[1]; ctx.fillRect(x, y + i, 1, 2); }
        } else {
          ctx.fillStyle = st === 'glass' ? TH.stal[1] : st === 'fungal' || st === 'heart' ? TH.tuft[0] : TH.stal[1];
          ctx.fillRect(x, y, 1, hh);
        }
      }
      for (const r of T.oneway || []) {
        const x0 = r[0] * TS, y0 = r[1] * TS, ww = r[2] * TS;
        if (!vis(x0, y0, ww, TS)) continue;
        const x = Math.round(x0 - camX), y = Math.round(y0 - camY);
        if (st === 'foundry') {
          ctx.fillStyle = TH.stal[1]; ctx.fillRect(x, y, ww, 2);
          ctx.fillStyle = dk; for (let i = 2; i < ww - 1; i += 3) ctx.fillRect(x + i, y + 1, 1, 1);
          ctx.fillStyle = md; ctx.fillRect(x + 1, y + 2, 1, 2); ctx.fillRect(x + ww - 2, y + 2, 1, 2);
        } else if (st === 'fungal') {
          ctx.fillStyle = TH.tuft[0]; ctx.fillRect(x, y, ww, 1); ctx.fillRect(x + 1, y + 1, ww - 2, 1); ctx.fillRect(x + 3, y + 2, ww - 6, 1);
          ctx.fillStyle = dk; for (let i = 3; i < ww - 3; i += 2) ctx.fillRect(x + i, y + 2, 1, 1);
          ctx.fillStyle = TH.tuft[1]; ctx.fillRect(x + 1, y, ww - 2, 1);
        } else if (st === 'glass') {
          ctx.globalAlpha = 0.75; ctx.fillStyle = TH.stal[1]; ctx.fillRect(x, y, ww, 2); ctx.globalAlpha = 1;
          ctx.fillStyle = c1; ctx.fillRect(x, y, ww, 1);
          const g = Math.floor(((time * 30) % (ww + 20)) - 10); if (g > 0 && g < ww) { ctx.fillStyle = '#fff'; ctx.fillRect(x + g, y, 2, 1); }
        } else if (st === 'heart') {
          ctx.fillStyle = TH.stal[1]; ctx.fillRect(x + 1, y, ww - 2, 2); ctx.fillStyle = TH.tuft[1]; ctx.fillRect(x + 1, y, ww - 2, 1);
          ctx.fillStyle = TH.stal[1]; ctx.fillRect(x, y - 1, 2, 3); ctx.fillRect(x + ww - 2, y - 1, 2, 3);
        } else {
          ctx.fillStyle = TH.stal[1]; ctx.fillRect(x, y, ww, 2); ctx.fillStyle = st === 'ember' ? TH.tuft[0] : '#94A6B1'; ctx.fillRect(x, y, ww, 1);
        }
      }
      // slick glass
      for (const r of T.ice || []) {
        const x0 = r[0] * TS, y0 = r[1] * TS, ww = r[2] * TS;
        if (!vis(x0, y0, ww, TS)) continue;
        const x = Math.round(x0 - camX), y = Math.round(y0 - camY);
        ctx.globalAlpha = 0.8; ctx.fillStyle = c1; ctx.fillRect(x, y, ww, 1); ctx.globalAlpha = 0.35; ctx.fillRect(x, y + 1, ww, 1); ctx.globalAlpha = 1;
      }
      // vents: a grate and rising air
      for (const v of L.vents || []) {
        const x0 = v[0] * TS, y0 = v[1] * TS, ww = v[2] * TS, hh = v[3] * TS;
        if (!vis(x0, y0, ww, hh)) continue;
        const x = Math.round(x0 - camX), yb = Math.round(y0 + hh - camY);
        ctx.fillStyle = TH.stal[1]; ctx.fillRect(x, yb - 1, ww, 1);
        ctx.fillStyle = dk; for (let i = 1; i < ww; i += 2) ctx.fillRect(x + i, yb - 1, 1, 1);
      }
      // hush stones
      for (const q of w.switches) {
        if (!vis(q.x - 6, q.y - 10, 12, 12)) continue;
        const x = Math.round(q.x - camX), y = Math.round(q.y - camY);
        ctx.fillStyle = dk; ctx.fillRect(x - 3, y - 6, 7, 6); ctx.fillRect(x - 2, y - 7, 5, 1);
        ctx.fillStyle = md; ctx.fillRect(x - 3, y - 6, 1, 6); ctx.fillRect(x - 2, y - 7, 5, 1);
      }
      return;
    }
    // ---- emissive parts, above the dark
    for (const r of T.bounce || []) {
      const x0 = r[0] * TS, y0 = r[1] * TS, ww = r[2] * TS;
      if (!vis(x0, y0 - 6, ww, TS + 6)) continue;
      let sq = 0;
      for (const b of bounceFx) if (b.x >= x0 - 2 && b.x <= x0 + ww + 2 && Math.abs(b.y - y0) < 4) sq = Math.max(sq, 1 - (time - b.t) / 0.35);
      sq = Math.max(0, sq);
      const x = Math.round(x0 - camX), y = Math.round(y0 - camY) + Math.round(sq * 2);
      const pulse = 0.55 + 0.25 * Math.sin(time * 3 + x0 * 0.1) + 0.4 * sq;
      if (st === 'foundry') {                    // a sprung plate
        ctx.fillStyle = TH.stal[1]; for (let i = 0; i < 3; i++) ctx.fillRect(x + 1 + i % 2, y - 3 + i, ww - 2 - (i % 2) * 2, 1);
        ctx.fillStyle = c1; ctx.globalAlpha = pulse; ctx.fillRect(x, y - 4, ww, 1); ctx.globalAlpha = 1;
      } else if (st === 'glass') {               // a prism pad
        ctx.globalAlpha = pulse; ctx.fillStyle = c1; ctx.fillRect(x, y - 2, ww, 2); ctx.fillStyle = c2; for (let i = 1; i < ww; i += 4) ctx.fillRect(x + i, y - 3, 2, 1); ctx.globalAlpha = 1;
      } else if (st === 'heart') {               // a drum of skin
        ctx.fillStyle = TH.tuft[0]; ctx.fillRect(x, y - 2, ww, 2); ctx.globalAlpha = pulse; ctx.fillStyle = TH.tuft[1]; ctx.fillRect(x + 1, y - 2, ww - 2, 1); ctx.globalAlpha = 1;
      } else {                                   // a springy cap
        ctx.fillStyle = TH.tuft[0]; ctx.fillRect(x, y - 2, ww, 2); ctx.fillRect(x + 1, y - 3, ww - 2, 1);
        ctx.globalAlpha = pulse; ctx.fillStyle = TH.tuft[1];
        for (let i = 2; i < ww - 1; i += 4) ctx.fillRect(x + i, y - 2, 1, 1);
        ctx.fillRect(x + 2, y - 3, ww - 4, 1); ctx.globalAlpha = 1;
      }
    }
    for (const v of L.vents || []) {
      const x0 = v[0] * TS, y0 = v[1] * TS, ww = v[2] * TS, hh = v[3] * TS;
      if (!vis(x0, y0, ww, hh)) continue;
      ctx.globalCompositeOperation = 'lighter';
      const n = Math.max(3, Math.round(ww / 3));
      for (let i = 0; i < n; i++) {
        const ph = (time * (0.6 + hash2(i, 3) * 0.5) + hash2(i, 9)) % 1;
        const xx = Math.round(x0 + (i + 0.5) * ww / n + Math.sin(time * 2 + i) * 1 - camX), yy = Math.round(y0 + hh - ph * hh - camY);
        ctx.fillStyle = 'rgba(' + TH.glowRGB + ',' + (0.25 * (1 - ph)).toFixed(3) + ')'; ctx.fillRect(xx, yy, 1, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const q of w.switches) {
      if (!vis(q.x - 12, q.y - 20, 24, 24)) continue;
      const x = Math.round(q.x - camX), y = Math.round(q.y - camY);
      const v = s['hs' + q.i] || 0, on = v > 0;
      const a = on ? 0.95 : 0.35 + 0.25 * Math.sin(time * 2.5 + q.i);
      ctx.globalAlpha = a; ctx.fillStyle = on ? c2 : c1;
      ctx.fillRect(x, y - 5, 1, 3); ctx.fillRect(x - 1, y - 4, 3, 1);       // the rune
      ctx.globalAlpha = 1;
      if (on) {                                                              // what is left of the hush, as a ring
        const k = v / q.dur, n = 20;
        ctx.fillStyle = c1;
        for (let i = 0; i < n * k; i++) { const an = -Math.PI / 2 + i / n * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(an) * 6), Math.round(y - 12 + Math.sin(an) * 6), 1, 1); }
      }
    }
  }

  /* drifting motes per level: spores, glints, sparks, embers */
  function drawMotes(ctx, camX, camY, W, H, time) {
    const m = TH.mote; if (!m) return;
    const st = TH.style, n = 26;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const h1 = hash2(i, 91), h2 = hash2(i, 17), h3 = hash2(i, 5);
      const par = 0.6 + h3 * 0.5;
      let x, y, a;
      const span = W + 40, spanY = H + 40;
      if (st === 'ember' || st === 'fungal' || st === 'heart') {          // rising
        const v = st === 'ember' ? 14 + h2 * 16 : 4 + h2 * 6;
        x = h1 * span - camX * par + Math.sin(time * (0.4 + h2) + i) * 6;
        y = h2 * spanY - camY * par - time * v;
      } else if (st === 'foundry') {                                       // falling sparks
        x = h1 * span - camX * par; y = h2 * spanY - camY * par + time * (30 + h3 * 30);
      } else {                                                             // glass: still glints
        x = h1 * span - camX * par; y = h2 * spanY - camY * par;
      }
      x = ((x % span) + span) % span - 20; y = ((y % spanY) + spanY) % spanY - 20;
      a = st === 'glass' ? Math.max(0, Math.sin(time * (1.5 + h3 * 2) + i * 3)) ** 6 : 0.35 + 0.35 * Math.sin(time * 2 + i);
      if (a < 0.03) continue;
      ctx.fillStyle = 'rgba(' + m[0] + ',' + m[1] + ',' + m[2] + ',' + (a * 0.5).toFixed(3) + ')';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (st === 'glass' && a > 0.5) { ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3); }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawDecorFront(ctx, w, camX, camY, W, H, time) {
    const x0 = Math.floor(camX / TS) - 2, x1 = Math.floor((camX + W) / TS) + 2;
    for (const h of decor.hang) {
      if (h.x < x0 || h.x > x1) continue;
      const px = h.x * TS - camX, py = h.y * TS - camY;
      if (py < -30 || py > H + 30) continue;
      const len = h.len * TS - 2;
      ctx.fillStyle = TH.stal[0];
      ctx.fillRect(px + 1, py, 4, 1);
      for (let i = 1; i < len; i++) { const wd = Math.max(1, Math.round(4 * (1 - i / len))); ctx.fillRect(px + 3 - (wd >> 1), py + i, wd, 1); }
      ctx.fillStyle = TH.stal[1]; ctx.fillRect(px + 1, py, 1, Math.max(1, len - 3));
    }
  }

  function drawHints(ctx, w, camX, camY, W, H, Gm) {
    for (const h of w.hints) {
      if (h.x < camX - 200 || h.x > camX + W + 200) continue;
      if (h.cmp !== undefined && h.cmp !== !!Gm.s.cmp) continue;
      const near = Math.abs((Gm.s.x) - h.x) < 120;
      ctx.globalAlpha = near ? 0.95 : 0.5;
      drawText(ctx, h.text, Math.round(h.x - camX), Math.round(h.y - camY), '#c9d3e0', 1, 'left');
    }
    ctx.globalAlpha = 1;
  }

  // black tar that fills every killing pit: slow swells, a glossy rim and bubbles that rise and pop
  function drawGoo(ctx, w, camX, camY, W, H, time, post) {
    for (const k of w.kills) {
      const x0 = Math.max(Math.floor(k[0] - camX), 0), x1 = Math.min(Math.ceil(k[2] - camX), W);
      if (x1 <= x0) continue;
      const top = k[1] - camY;
      if (top > H + 4 || top < -400) continue;
      const bot = H + 2;
      for (let x = x0; x < x1; x++) {
        const wx = x + camX;
        const sw = Math.sin(wx * 0.21 + time * 1.6) * 1.1 + Math.sin(wx * 0.07 - time * 1.1) * 1.4;
        const y = Math.round(top + sw);
        if (post) {
          // faint wet sheen on the swells, drawn above the dark pass so the tar reads as liquid
          const a = Math.max(0, sw - 0.2) * 0.22 + (Math.sin(wx * 0.5 + time * 3) > 0.92 ? 0.25 : 0);
          if (a > 0.04) { ctx.globalAlpha = Math.min(a, 0.55); ctx.fillStyle = TH.sheen; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; }
          continue;
        }
        ctx.fillStyle = '#040408'; ctx.fillRect(x, y, 1, bot - y);
        ctx.fillStyle = '#0c0b14'; ctx.fillRect(x, y, 1, 1);
        const dr = Math.sin(wx * 0.13 + time * 0.7) + Math.sin(wx * 0.31 - time * 0.4);
        if (dr > 1.55) { ctx.fillStyle = '#0a0a12'; ctx.fillRect(x, y + 2, 1, 3); }
      }
      if (post) continue;
      // bubbles
      const n = Math.ceil((k[2] - k[0]) / 40);
      for (let i = 0; i < n; i++) {
        const per = 2.2 + hash2(i, 7) * 2.5, ph = (time / per + hash2(i, 3)) % 1;
        const bx = Math.round(k[0] + (i + hash2(i, 11)) * (k[2] - k[0]) / n - camX);
        if (bx < x0 || bx >= x1) continue;
        const by = Math.round(top + 6 - ph * 8);
        if (ph < 0.8) {
          const r = ph < 0.4 ? 1 : 2;
          ctx.fillStyle = '#14141f'; ctx.fillRect(bx - r, by - r, r * 2 + 1, r * 2 + 1);
          ctx.fillStyle = '#3a3a52'; ctx.fillRect(bx - r + 1, by - r, 1, 1);
        } else {
          ctx.fillStyle = '#2a2a3c'; ctx.fillRect(bx - 2, Math.round(top) - 1, 1, 1); ctx.fillRect(bx + 2, Math.round(top) - 1, 1, 1);
        }
      }
    }
  }

  function drawScene(ctx, Gm, camX, camY, W, H) {
    const w = Gm.w, s = Gm.s, time = Gm.time; sceneTime = time;
    drawBackground(ctx, w, camX, camY, W, H, time);
    drawDecorBack(ctx, w, camX, camY, W, H, time);
    // objects behind the player
    for (const l of w.lights) {
      if (l.boss || l.x < camX - 60 || l.x > camX + W + 60 || l.y < camY - 60 || l.y > camY + H + 60) continue;
      if (l.t === 'watch') drawWatcher(ctx, l, camX, camY, time, false, 0, null, w);
      else if (l.t === 'orb' && TH.style === 'foundry' && l.move && l.move.k === 'line' && l.move.dy === 0) {
        // a lamp on a crane: it runs on a trolley along the roof
        if (drawCord(ctx, w, l.x, l.y, camX, camY, 4)) {
          const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS), top = openUp(w, tx, ty, 90);
          const ry = Math.round((ty - top) * TS - camY), rx = Math.round(l.x - camX);
          ctx.fillStyle = TH.stal[1]; ctx.fillRect(rx - 3, ry, 7, 2); ctx.fillStyle = TH.near; ctx.fillRect(rx - 2, ry + 2, 5, 1);
        }
      }
      else if (l.t === 'lamp' && l.col !== 'rainbow' && l.col !== 'shard') drawLampCrystal(ctx, w, l, camX, camY, time, false);
    }
    for (const c of w.checks) if (c.x > camX - 30 && c.x < camX + W + 30) drawTether(ctx, c, s, camX, camY, time);
    drawGoo(ctx, w, camX, camY, W, H, time);
    drawTerrain(ctx, w, camX, camY, W, H);
    if (w.secret && !s.cmp) drawMini(ctx, w.secret.x, w.secret.y - 2, time, 'off', 1);
    drawFakes(ctx, w, s, camX, camY, Gm.dt || 0.016);
    drawFeatures(ctx, w, s, camX, camY, W, H, time, false);
    drawAlcoves(ctx, w, s, camX, camY, time, false);
    drawDecorFront(ctx, w, camX, camY, W, H, time);
    if (!s.won || s.wonT < 30) drawPlayer(ctx, s, camX, camY, 'body', s.burn > 0.02 && !s.dead ? 0.15 + s.burn * 0.6 : 0);
    drawParticles(ctx, camX, camY);
    lightPass(ctx, Gm, camX, camY, W, H);
    drawGoo(ctx, w, camX, camY, W, H, time, true);
    drawFeatures(ctx, w, s, camX, camY, W, H, time, true);
    // hints live in the dark ceiling rock, drawn above the dark pass so they stay readable
    drawHints(ctx, w, camX, camY, W, H, Gm);
    if (w.boss) { drawGuardian(ctx, w, s, camX, camY, time); drawAlcoves(ctx, w, s, camX, camY, time, true); drawGuardianBits(ctx, camX, camY, Gm.dt || 0.016); }
    // emissive things, drawn after the dark
    for (const l of w.lights) {
      if (l.boss || l.x < camX - 60 || l.x > camX + W + 60 || l.y < camY - 60 || l.y > camY + H + 60) continue;
      if (l.t === 'orb') drawOrb(ctx, l, camX, camY, time, w);
      else if (l.t === 'watch') drawWatcher(ctx, l, camX, camY, time, true, s.dead ? 0 : D.lightAt(w, l, s.x + 2.5, s.y + s.h * 0.5) * 3, s, w);
      else if (l.t === 'lamp' && l.col !== 'rainbow' && l.col !== 'shard') drawLampCrystal(ctx, w, l, camX, camY, time, true);
      else if (l.t === 'beam') drawBeamEmitter(ctx, l, camX, camY, time);
    }
    if (!s.dead && !(s.won && s.wonT > 30)) {
      // only the visor stays visible in shadow
      const vis = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(time * 5.0));
      ctx.globalAlpha = s.ex > 0.05 ? Math.min(1, vis + s.ex) : vis;
      drawPlayer(ctx, s, camX, camY, 'visor', 0);
      ctx.globalAlpha = 1;
    }
    // coloured glow over the lit scene
    ctx.globalCompositeOperation = 'lighter';
    for (const l of w.lights) {
      if (l.x < camX - l.reach || l.x > camX + W + l.reach || l.y < camY - l.reach || l.y > camY + H + l.reach) continue;
      if ((l.t === 'lamp' || l.t === 'orb') && !(l.boss && l.boss !== 'flare')) {
        if (l.k < 0.02) continue;
        const gr = ctx.createRadialGradient(l.x - camX, l.y - camY, 0, l.x - camX, l.y - camY, l.r * 0.5);
        gr.addColorStop(0, 'rgba(' + TH.glowRGB + ',' + (0.16 * l.k * l.I).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + TH.glowRGB + ',0)');
        ctx.fillStyle = gr; ctx.fillRect(l.x - l.r * 0.5 - camX, l.y - l.r * 0.5 - camY, l.r, l.r);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    drawMotes(ctx, camX, camY, W, H, time);
    // the sliver of the crystal and its light
    const g = w.goal;
    if (g.x > camX - 150 && g.x < camX + W + 150) {
      const rgb = hexRGB(shardCol);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = time * 0.6 + i * (Math.PI / 2);
        const gr = ctx.createRadialGradient(g.x - camX, g.y - camY, 0, g.x - camX + Math.cos(a) * 16, g.y - camY + Math.sin(a) * 10, 64);
        const al = 0.16 + 0.05 * Math.sin(time * 2 + i);
        gr.addColorStop(0, 'rgba(' + rgb.join(',') + ',' + al.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
        ctx.fillStyle = gr; ctx.fillRect(g.x - camX - 90, g.y - camY - 90, 180, 180);
      }
      ctx.globalCompositeOperation = 'source-over';
      drawShard(ctx, g.x - camX, g.y - camY + Math.sin(time * 2.1) * 1.5, shardCol, time, s.won ? Math.min(1, s.wonT / 60) : 0);
    }
    // the companion, above everything it eclipses
    if (s.cmp) {
      const holding = s.cmp === 3, kk = s.cmpK;
      if (kk > 0.05 && s.cmpL >= 0) {
        // the corona of the eclipsed light
        const cx = s.cmpX - camX, cy = s.cmpY - camY;
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(cx, cy, 5, cx, cy, 13);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(' + TH.glowRGB + ',' + (0.45 * kk).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + TH.glowRGB + ',0)');
        ctx.fillStyle = gr; ctx.fillRect(cx - 14, cy - 14, 28, 28);
        ctx.globalCompositeOperation = 'source-over';
      }
      const mode = s.cmp === 1 && s.cmpCD > 0 ? 'cool' : 'on';
      drawMini(ctx, s.cmpX - camX, s.cmpY - camY, time, mode, holding ? 1 : s.face, 1 - s.cmpCD / D.C.CMPCD);
    }
  }

  global.DwellerRender = {
    PAL, load, prepare, drawScene, drawText, textWidth, textSprite, spawn, updateParticles, markTether, tickTethers,
    SHEETS, IMG, parts, hsl, hash2, SHARDS, THEMES, drawGem, drawShard, drawMini, drawPortrait, shade,
    get theme() { return TH; }, SEEKERS, setSeeker, BREATH, get seekerId() { return seekerId; }, resetTethers() { tetherT = {}; }, noteBounce, guardianBurst, clearGuardian() { gBits.length = 0; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
