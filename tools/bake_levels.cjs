/* Bakes every level's terrain tiles with The Seeker's ice-biome tiling (bake_terrain.cjs, from the community-games
 * port of DWELLER) and writes build/terrain<N>.png next to build/level<N>.json.
 * False walls are tiled as rock so they read as stone; the renderer draws them on their own fading layer.
 * Usage: node tools/bake_levels.cjs [tools/ice_tiling.json]   (the tiling comes from extract_ice_tiling.py) */
const fs = require('fs'), path = require('path');
const { bakeLevel, png } = require('./bake_terrain.cjs');
const D = require('../src/sim.js');
const root = path.join(__dirname, '..');
const T = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, 'ice_tiling.json'), 'utf8'));
const deepDir = path.join(root, 'build', 'deep');
const deep = fs.existsSync(deepDir) ? fs.readdirSync(deepDir).filter(f => /^[a-z]+\d\.json$/.test(f)).map(f => path.join(deepDir, f)) : [];
const files = [];
for (let n = 1; n <= 9; n++) files.push([path.join(root, 'build', `level${n}.json`), path.join(root, 'build', `terrain${n}.png`), 'level ' + n]);
for (const f of deep) files.push([f, f.replace(/([a-z]+\d)\.json$/, 'terrain_$1.png'), 'deep ' + path.basename(f, '.json')]);
for (const [file, out, label] of files) {
  if (!fs.existsSync(file)) continue;
  const level = JSON.parse(fs.readFileSync(file, 'utf8'));
  const w = D.makeWorld(level);
  const fake = new Uint8Array(w.W * w.H);
  for (const f of w.fakes) for (let y = f[1]; y < f[1] + f[3]; y++) for (let x = f[0]; x < f[0] + f[2]; x++) if (x >= 0 && y >= 0 && x < w.W && y < w.H) fake[y * w.W + x] = 1;
  const visible = { solidAt: (ww, x, y) => D.solidAt(ww, x, y) || (x >= 0 && y >= 0 && x < w.W && y < w.H && fake[y * w.W + x] === 1) };
  fs.writeFileSync(out, png(w.W, w.H, bakeLevel(T, visible, w)));
  console.log(`${label}: baked ${w.W}x${w.H} cells -> ${path.relative(root, out)}`);
}
