// visual sanity checks: things that should be attached to rock, and things that should not be inside it
const D = require('../src/sim.js');
const TS = 6;
for (let n = 1; n <= 6; n++) {
  const L = JSON.parse(require('fs').readFileSync(__dirname + `/../build/level${n}.json`));
  const w = D.makeWorld(L);
  const S = (x, y) => D.solidAt(w, x, y);
  const out = [];
  const up = (tx, ty, lim) => { let k = 0; while (k < lim && !S(tx, ty - k - 1)) k++; return k; };
  const dn = (tx, ty, lim) => { let k = 0; while (k < lim && !S(tx, ty + k + 1)) k++; return k; };
  const sec = (x) => { const s = L.sections.filter(q => q.x0 * TS <= x).pop(); return s ? s.title.trim() : '?'; };
  for (const l of L.lights) {
    const tx = Math.floor(l.x / TS), ty = Math.floor(l.y / TS);
    if (S(tx, ty) && l.t !== 'beam') out.push(`${l.t}${l.col ? '/' + l.col : ''} INSIDE ROCK at ${tx},${ty} [${sec(l.x)}]`);
    if (l.t === 'lamp' && l.col !== 'shard' && l.col !== 'cap') { const u = up(tx, ty, 200); if (u >= 16) out.push(`lamp cord ${u} tiles at ${tx},${ty} [${sec(l.x)}]`); }
    if (l.t === 'lamp' && l.col === 'cap') { const d = dn(tx, ty, 200); if (d >= 6) out.push(`cap stalk ${d} tiles to floor at ${tx},${ty} (ceiling ${up(tx, ty, 200)}) [${sec(l.x)}]`); }
    if (l.t === 'beam') {
      let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (S(Math.floor(l.x / TS + dx * 0.9), Math.floor(l.y / TS + dy * 0.9))) near = true;
      if (!near) out.push(`beam emitter floating at ${tx},${ty} ang ${Math.round(l.ang * 57.3)} [${sec(l.x)}]`);
    }
    if (l.t === 'watch') {
      let near = false; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (S(tx + dx, ty + dy)) near = true;
      if (!near) out.push(`eye floating at ${tx},${ty} [${sec(l.x)}]`);
    }
  }
  for (const v of L.vines || []) for (let k = 0; k < v[2]; k++) if (!S(v[0] + k, v[1] - 1)) out.push(`vine top loose by ${up(v[0] + k, v[1], 200)} at ${v[0] + k},${v[1]} [${sec(v[0] * TS)}]`);
  for (const q of L.switches || []) { const tx = Math.floor(q.x / TS), ty = Math.floor(q.y / TS); if (!S(tx, ty)) out.push(`hush stone not on floor at ${tx},${ty} [${sec(q.x)}]`); }
  for (const c of L.checks) { const tx = Math.floor(c.x / TS), ty = Math.floor(c.y / TS); if (!S(tx, ty) || S(tx, ty - 1)) out.push(`tether pole bad at ${tx},${ty} [${sec(c.x)}]`); }
  if (0) for (const h of L.hints || []) { const tx = Math.floor(h.x / TS), ty = Math.floor(h.y / TS); let bad = 0; for (let i = 0; i < h.text.length * 4 / TS; i++) if (S(tx + i, ty)) bad++; if (bad) out.push(`hint text over rock (${bad} tiles) '${h.text.slice(0, 24)}' at ${tx},${ty} [${sec(h.x)}]`); }
  for (const v of L.vents || []) { const x = v[0], y1 = v[1] + v[3]; if (!S(x, y1) && !S(x, y1 - 0)) out.push(`vent base floating at ${x},${y1} [${sec(x * TS)}]`); }
  console.log(`== level ${n}: ${out.length}`); for (const o of out) console.log('  ' + o);
}
