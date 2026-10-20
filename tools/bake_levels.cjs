/* Bakes every level's terrain tiles with The Seeker's ice-biome tiling (bake_terrain.cjs, from the community-games
 * port of DWELLER) and writes build/terrain<N>.png next to build/level<N>.json.
 * False walls are tiled as rock so they read as stone; the renderer draws them on their own fading layer.
 * Usage: node tools/bake_levels.cjs [tools/ice_tiling.json]   (the tiling comes from extract_ice_tiling.py) */
const fs = require('fs'), path = require('path');
const { bakeLevel, png } = require('./bake_terrain.cjs');
const D = require('../src/sim.js');
const root = path.join(__dirname, '..');
const T = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, 'ice_tiling.json'), 'utf8'));
for (let n = 1; n <= 9; n++) {
  const file = path.join(root, 'build', `level${n}.json`);
  if (!fs.existsSync(file)) continue;
  const level = JSON.parse(fs.readFileSync(file, 'utf8'));
  const w = D.makeWorld(level);
  const fake = new Uint8Array(w.W * w.H);
  for (const f of w.fakes) for (let y = f[1]; y < f[1] + f[3]; y++) for (let x = f[0]; x < f[0] + f[2]; x++) if (x >= 0 && y >= 0 && x < w.W && y < w.H) fake[y * w.W + x] = 1;
  const visible = { solidAt: (ww, x, y) => D.solidAt(ww, x, y) || (x >= 0 && y >= 0 && x < w.W && y < w.H && fake[y * w.W + x] === 1) };
  const out = path.join(root, 'build', `terrain${n}.png`);
  fs.writeFileSync(out, png(w.W, w.H, bakeLevel(T, visible, w)));
  console.log(`level ${n}: baked ${w.W}x${w.H} cells -> ${path.relative(root, out)}`);
}
