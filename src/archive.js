/* DWELLER — the art of THE CODEX, the Guardian's arena after the Core is won.
 * Two towers of balconies face the Guardian's empty shell across an open void. Every seeker rests in an arched
 * niche of its own, carved into a slate wall, over a balcony with a crystal lip, a balustrade and a strip of runes.
 * The room lights itself (its lights go into the game's own light pass, so the carving emerges from the dark the way
 * the caves do): the shell, each occupied niche, the hot air, the hole into The Deep. Every few beats a slow breath
 * of light leaves the shell and passes over the towers, waking the runes as it goes.
 *   drawBack(ctx, cx, cy, st)   the architecture, behind the player (lit by lift)
 *   lift(lctx, cx, cy, disc, st) light for the light pass
 *   drawFront(ctx, cx, cy, st)  air, light and life, in front: rings, aurora, mist, the hole's light, motes
 * st: { L (the level), time, pl (who sits where), focus (a slot), iris (0..1), LW, LH, S (the player) } */
(function (global) {
  'use strict';
  const TS = 6;
  let cache = null, cacheFor = null, CX0 = 0, CY0 = 0;
  const motes = [];

  function rect(x, c, X, Y, w, h) { x.fillStyle = c; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); }

  /* the towers, built once into one picture */
  function towersOf(L) {
    const sh = (L.tiles && L.tiles.oneway) || [];
    const side = (f) => { const q = sh.filter(f); return { x0: Math.min(...q.map(s => s[0])) * TS, x1: Math.max(...q.map(s => s[0] + s[2])) * TS, rows: [...new Set(q.map(s => s[1]))].sort((a, b) => a - b).map(r => r * TS) }; };
    return [Object.assign(side(s => s[0] < 140), { inner: 'right' }), Object.assign(side(s => s[0] > 140), { inner: 'left' })];
  }
  function build(L) {
    const A = L.archive, T = towersOf(L);
    CX0 = 380; CY0 = 60;
    const W = 1290 - CX0, H = 600 - CY0;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const X = (v) => v - CX0, Y = (v) => v - CY0;
    const slots = A.high.concat(A.wall, A.floor);
    // the ceiling: crystals hanging from the dark
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let wx = 430; wx < 1250; wx += 3 + Math.floor(rnd() * 5)) {
      const len = 3 + Math.floor(rnd() * 12), w = 1 + (rnd() < 0.4 ? 1 : 0);
      for (let k = 0; k < len; k++) rect(x, k < 2 ? '#2a2342' : k % 3 === 0 ? '#4b3f78' : '#352b58', X(wx), Y(72 + k), Math.max(1, w - (k > len - 3 ? 1 : 0)), 1);
      rect(x, '#8a7ac8', X(wx), Y(72 + Math.floor(len / 2)), 1, 1);
    }
    for (const t of T) {
      const x0 = t.x0 - 6, x1 = t.x1 + 6, top = t.rows[0] - 52, bot = 552;
      // the back wall: slate, with a soft vertical banding
      const g = x.createLinearGradient(0, Y(top), 0, Y(bot)); g.addColorStop(0, '#0e131c'); g.addColorStop(1, '#141c27');
      x.fillStyle = g; x.fillRect(X(x0), Y(top), x1 - x0, bot - top);
      for (let wx = x0 + 3; wx < x1 - 2; wx += 7) rect(x, wx % 14 < 7 ? '#121925' : '#10161f', X(wx), Y(top), 3, bot - top);
      // a roof over the tower: a heavy lintel with a row of carved squares
      rect(x, '#202a38', X(x0 - 2), Y(top - 6), x1 - x0 + 4, 6); rect(x, '#3a4a60', X(x0 - 2), Y(top - 6), x1 - x0 + 4, 1);
      for (let wx = x0; wx < x1; wx += 5) rect(x, '#141b25', X(wx), Y(top - 3), 2, 2);
      // each tier: a cornice, the niches, the pilasters, the balcony
      for (const ry of t.rows) {
        rect(x, '#1c2532', X(x0), Y(ry - 46), x1 - x0, 2); rect(x, '#2c394b', X(x0), Y(ry - 47), x1 - x0, 1);
        const here = slots.filter(p => p[1] === ry && p[0] >= x0 && p[0] <= x1).map(p => p[0]).sort((a, b) => a - b);
        // pilasters between and beside the niches
        const pil = [x0 + 4].concat(here.slice(1).map((v, i) => (v + here[i]) / 2), [x1 - 4]);
        for (const px of pil) { rect(x, '#1a2230', X(px - 1), Y(ry - 44), 3, 44); rect(x, '#26313f', X(px - 1), Y(ry - 44), 1, 44); rect(x, '#2c394b', X(px - 2), Y(ry - 44), 5, 2); }
        // the niches: an arch carved into the wall, dark inside, a keystone above
        for (const nx of here) {
          const w = 16, hh = 36, top2 = ry - hh, r = w / 2;
          for (let j = 0; j < hh; j++) {
            const yy = top2 + j, half = j < r ? Math.round(Math.sqrt(Math.max(0, r * r - (r - j) * (r - j)))) : r;
            rect(x, '#2a3646', X(nx - half - 1), Y(yy), 1, 1); rect(x, '#0b0f15', X(nx + half), Y(yy), 1, 1);
            const ig = j / hh;
            rect(x, 'rgb(' + Math.round(6 + 6 * ig) + ',' + Math.round(9 + 8 * ig) + ',' + Math.round(14 + 10 * ig) + ')', X(nx - half), Y(yy), half * 2, 1);
          }
          rect(x, '#3d4c62', X(nx - 2), Y(top2 - 2), 4, 3); rect(x, '#56688a', X(nx - 1), Y(top2 - 2), 2, 1);
          // a small brass plaque on the balcony's face, under the niche
          rect(x, '#3b3324', X(nx - 4), Y(ry + 2), 8, 3); rect(x, '#6b5a36', X(nx - 4), Y(ry + 2), 8, 1);
        }
        // the balcony: a crystal lip, a slate slab with a row of carved squares, brackets beneath, a rune strip under that
        const sx0 = t.x0, sx1 = t.x1, w = sx1 - sx0;
        const sg = x.createLinearGradient(0, Y(ry), 0, Y(ry + 8)); sg.addColorStop(0, '#34425a'); sg.addColorStop(1, '#161e2a');
        x.fillStyle = sg; x.fillRect(X(sx0), Y(ry), w, 8);
        rect(x, '#bfe7e0', X(sx0), Y(ry), w, 1); rect(x, '#5f8f96', X(sx0), Y(ry + 1), w, 1);
        for (let wx = sx0 + 2; wx < sx1 - 1; wx += 4) rect(x, '#111720', X(wx), Y(ry + 5), 2, 1);
        rect(x, '#0a0e14', X(sx0), Y(ry + 8), w, 1);
        rect(x, '#0c1119', X(sx0 + 2), Y(ry + 9), w - 4, 2);
        for (let wx = sx0 + 8; wx < sx1 - 4; wx += 14) { rect(x, '#202a37', X(wx), Y(ry + 9), 7, 2); rect(x, '#1a2230', X(wx + 1), Y(ry + 11), 5, 2); rect(x, '#151c27', X(wx + 2), Y(ry + 13), 3, 2); rect(x, '#11171f', X(wx + 3), Y(ry + 15), 1, 2); }
        // a balustrade along the void side, and a crystal finial at its end
        const inner = t.inner === 'right' ? sx1 : sx0, dir = t.inner === 'right' ? -1 : 1;
        for (let k = 0; k < 4; k++) rect(x, '#3a4658', X(inner + dir * (2 + k * 4)), Y(ry - 4), 1, 4);
        rect(x, '#4a5a72', X(Math.min(inner, inner + dir * 15)), Y(ry - 5), 15, 1);
        rect(x, '#9fe0d4', X(inner - 1), Y(ry - 8), 3, 3); rect(x, '#e8fffa', X(inner), Y(ry - 8), 1, 1);
      }
      // the plinth under the lowest balcony: a frieze, and a great arch into the tower's foot
      const pTop = t.rows[t.rows.length - 1] + 20, mid = (t.x0 + t.x1) / 2, aw = 34, ah = bot - pTop - 10;
      rect(x, '#1a2230', X(x0), Y(pTop), x1 - x0, 6); rect(x, '#2c394b', X(x0), Y(pTop), x1 - x0, 1); rect(x, '#0b1017', X(x0), Y(pTop + 6), x1 - x0, 1);
      for (let wx = x0 + 3; wx < x1 - 3; wx += 6) rect(x, '#10161f', X(wx), Y(pTop + 2), 3, 2);
      for (let j = 0; j < ah; j++) {
        const yy = bot - j, top3 = ah - aw / 2, half = j > top3 ? Math.round(Math.sqrt(Math.max(0, (aw / 2) * (aw / 2) - (j - top3) * (j - top3)))) : aw / 2;
        rect(x, '#2e3b4e', X(mid - half - 2), Y(yy), 2, 1); rect(x, '#0a0e14', X(mid + half), Y(yy), 2, 1);
        rect(x, '#06080c', X(mid - half), Y(yy), half * 2, 1);
      }
      rect(x, '#44556e', X(mid - 3), Y(bot - ah - 3), 6, 4);
      // the column at the inner corner: fluted, with a capital at every tier
      const colX = t.inner === 'right' ? t.x1 : t.x0;
      rect(x, '#1b2431', X(colX - 4), Y(top), 8, bot - top);
      for (const k of [-3, -1, 1, 3]) rect(x, k < 0 ? '#2b3849' : '#121821', X(colX + k), Y(top), 1, bot - top);
      for (const ry of t.rows) { rect(x, '#33415a', X(colX - 6), Y(ry - 2), 12, 2); rect(x, '#4c5d78', X(colX - 6), Y(ry - 2), 12, 1); }
      rect(x, '#33415a', X(colX - 7), Y(top - 8), 14, 3);
    }
    // a band of runes carved into the floor around the hole
    const h0 = A.hole[0], h1 = A.hole[1], fy = A.hole[2];
    for (let wx = h0 - 70; wx < h1 + 70; wx += 4) if (wx < h0 - 2 || wx > h1 + 2) rect(x, '#1a2233', X(wx), Y(fy + 2), 2, 1);
    cache = c; cacheFor = L;
  }

  function drawBack(ctx, cx, cy, st) {
    if (cacheFor !== st.L) build(st.L);
    ctx.drawImage(cache, Math.round(CX0 - cx), Math.round(CY0 - cy));
  }

  /* the breath: every nine seconds a ring of light leaves the shell and crosses the room */
  const BREATH = 9;
  function breath(st) { const u = (st.time % BREATH) / BREATH; return { r: u * 720, a: Math.sin(Math.PI * Math.min(1, u * 1.2)) }; }
  function nearRing(st, x, y) { const A = st.L.archive, b = breath(st), d = Math.hypot(x - A.core[0], y - A.core[1]); return Math.max(0, 1 - Math.abs(d - b.r) / 34) * b.a; }

  function lanterns(st) {
    const A = st.L.archive, t = st.time;
    return [-1, 1].map((side, i) => { const ax = A.core[0] + side * 150, ay = 72, len = 150 + i * 26, sw = Math.sin(t * 0.6 + i * 1.7) * 0.05; return { ax, ay, x: ax + Math.sin(sw) * len, y: ay + Math.cos(sw) * len, i }; });
  }
  function lift(lctx, cx, cy, disc, st) {
    const A = st.L.archive, L = st.L;
    for (const ln of lanterns(st)) disc(lctx, ln.x - cx, ln.y - cy, 60, 0.4);
    disc(lctx, A.core[0] - cx, A.core[1] - cy, 170, 0.42 + 0.2 * st.iris);
    for (const sl of st.pl.slots) {
      const on = st.focus && sl.id === st.focus, w = nearRing(st, sl.x, sl.y - 18);
      disc(lctx, sl.x - cx, sl.y - 18 - cy, on ? 40 : 24, (on ? 0.6 : 0.26) + 0.25 * w);
    }
    for (const p of st.pl.empty) disc(lctx, p[0] - cx, p[1] - 18 - cy, 16, 0.08 + 0.2 * nearRing(st, p[0], p[1] - 18));
    for (const v of L.vents || []) disc(lctx, (v[0] + v[2] / 2) * TS - cx, (v[1] + v[3]) * TS - 10 - cy, 40, 0.4);
    disc(lctx, (A.hole[0] + A.hole[1]) / 2 - cx, A.hole[2] - cy, 70, 0.35);
    for (const a of A.alcoves) disc(lctx, a[0] - cx, a[1] - 14 - cy, 22, 0.3);
  }

  function drawFront(ctx, cx, cy, st) {
    const A = st.L.archive, L = st.L, t = st.time, LW = st.LW, LH = st.LH;
    const bx = A.core[0] - cx, by = A.core[1] - cy;
    const glow = (x, y, r, rgb, a) => { if (a <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    ctx.globalCompositeOperation = 'lighter';
    // an aurora under the ceiling, in the void between the towers
    for (let k = 0; k < 2; k++) {
      for (let xx = 620 - cx; xx < 1060 - cx; xx += 2) {
        const wx = xx + cx, yy = 100 + k * 26 + Math.sin(wx * 0.012 + t * (0.25 + 0.1 * k) + k * 2) * 12 + Math.sin(wx * 0.031 - t * 0.4) * 4 - cy;
        const a = 0.05 + 0.04 * Math.sin(wx * 0.02 + t * 0.6 + k);
        const g = ctx.createLinearGradient(0, yy - 14, 0, yy + 14); const col = k ? '150,110,230' : '90,220,190';
        g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(0.5, 'rgba(' + col + ',' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g; ctx.fillRect(xx, yy - 14, 2, 28);
      }
    }
    // echoes of the Guardian: great faint rings turning slowly behind the shell
    for (const [r, sp, n] of [[150, 0.03, 60], [205, -0.02, 84], [262, 0.012, 108]]) {
      for (let k = 0; k < n; k++) {
        if (k % 4 === 3) continue;
        const a = k / n * Math.PI * 2 + t * sp;
        ctx.fillStyle = 'rgba(110,200,185,0.16)'; ctx.fillRect(Math.round(bx + Math.cos(a) * r), Math.round(by + Math.sin(a) * r * 0.92), 1, 1);
      }
    }
    // the breath crossing the room
    const b = breath(st);
    if (b.a > 0.02) {
      for (let k = 0; k < 120; k++) {
        const a = k / 120 * Math.PI * 2;
        ctx.fillStyle = 'rgba(160,240,225,' + (0.18 * b.a).toFixed(3) + ')'; ctx.fillRect(Math.round(bx + Math.cos(a) * b.r), Math.round(by + Math.sin(a) * b.r * 0.92), 1, 1);
      }
    }
    // mist in the void
    for (let k = 0; k < 4; k++) {
      const yy = by - 120 + k * 80 + Math.sin(t * 0.2 + k) * 10, xx = bx + Math.sin(t * 0.07 + k * 1.7) * 60;
      glow(xx, yy, 140, '70,100,120', 0.07);
    }
    // the runes under every balcony wake as the breath passes; the niches glow, gold up high
    const T = towersOf(L);
    for (const tw of T) for (const ry of tw.rows) {
      for (let wx = tw.x0 + 3; wx < tw.x1 - 2; wx += 3) {
        const w = nearRing(st, wx, ry + 10), base = 0.08 + 0.05 * Math.sin(wx * 0.3 + t * 0.8);
        ctx.fillStyle = 'rgba(140,220,210,' + (base + 0.6 * w).toFixed(3) + ')'; ctx.fillRect(Math.round(wx - cx), Math.round(ry + 10 - cy), 1, 1);
      }
    }
    for (const sl of st.pl.slots) {
      const x = sl.x - cx, y = sl.y - cy, on = st.focus && sl.id === st.focus, w = nearRing(st, sl.x, sl.y - 18);
      if (x < -60 || x > LW + 60 || y < -60 || y > LH + 60) continue;
      const rgb = sl.band === 'high' ? '230,190,120' : sl.band === 'new' ? '170,195,255' : '120,220,200';
      glow(x, y - 20, on ? 26 : 14, rgb, (on ? 0.34 : 0.12) + 0.16 * w);
      // the niche's inside fills with light from below
      const g = ctx.createLinearGradient(0, y - 34, 0, y); g.addColorStop(0, 'rgba(' + rgb + ',0)'); g.addColorStop(1, 'rgba(' + rgb + ',' + ((on ? 0.3 : 0.1) + 0.12 * w).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(Math.round(x - 7), Math.round(y - 34), 14, 34);
      // the brass plaque catches it
      ctx.fillStyle = 'rgba(255,220,150,' + ((on ? 0.5 : 0.15) + 0.3 * w).toFixed(3) + ')'; ctx.fillRect(Math.round(x - 3), Math.round(y + 3), 6, 1);
      if (on) { const pr = (t * 30) % 30; ctx.strokeStyle = 'rgba(160,240,225,' + (0.5 * (1 - pr / 30)).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 0.5, y - 17.5, 8 + pr, 0, Math.PI * 2); ctx.stroke(); }
    }
    // the crystal finials and the ceiling's crystals glint
    for (const tw of T) for (const ry of tw.rows) { const fx = (tw.inner === 'right' ? tw.x1 : tw.x0) - cx; glow(fx, ry - 7 - cy, 6, '160,240,225', 0.15 + 0.15 * Math.max(0, Math.sin(t * 2 + ry))); }
    for (let k = 0; k < 9; k++) { const wx = 450 + ((k * 97) % 800), u = (t * 0.5 + k * 0.37) % 1; if (u < 0.15) glow(wx - cx, 80 - cy, 8, '150,130,230', 0.4 * (1 - u / 0.15)); }
    // the lanterns: a chain from the ceiling, a cage of dark iron, a crystal burning cold inside
    ctx.globalCompositeOperation = 'source-over';
    for (const ln of lanterns(st)) {
      const n = Math.ceil(Math.hypot(ln.x - ln.ax, ln.y - ln.ay) / 3);
      for (let k = 0; k < n; k++) { const u = k / n; ctx.fillStyle = k % 2 ? '#2a3240' : '#3a4454'; ctx.fillRect(Math.round(ln.ax + (ln.x - ln.ax) * u - cx), Math.round(ln.ay + (ln.y - ln.ay) * u - cy), 1, 2); }
      const X = Math.round(ln.x - cx), Y = Math.round(ln.y - cy);
      ctx.fillStyle = '#1c232e'; ctx.fillRect(X - 4, Y, 9, 2); ctx.fillRect(X - 4, Y + 12, 9, 2); ctx.fillRect(X - 4, Y + 2, 1, 10); ctx.fillRect(X + 4, Y + 2, 1, 10); ctx.fillRect(X, Y + 2, 1, 10);
      ctx.fillStyle = '#9fe0d4'; ctx.fillRect(X - 2, Y + 4, 2, 6); ctx.fillRect(X + 2, Y + 5, 1, 4); ctx.fillStyle = '#eafffb'; ctx.fillRect(X - 1, Y + 5, 1, 3);
      ctx.fillStyle = '#1c232e'; ctx.fillRect(X - 1, Y + 14, 3, 2);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const ln of lanterns(st)) { glow(ln.x - cx, ln.y + 7 - cy, 30, '140,230,210', 0.22 + 0.06 * Math.sin(t * 2.3 + ln.i)); glow(ln.x - cx, ln.y + 7 - cy, 8, '220,255,248', 0.4); }
    // the frieze over each tower's arch wakes with the breath
    for (const tw of T) {
      const pTop = tw.rows[tw.rows.length - 1] + 20;
      for (let wx = tw.x0 - 3; wx < tw.x1 + 3; wx += 6) { const w2 = nearRing(st, wx, pTop); ctx.fillStyle = 'rgba(140,220,210,' + (0.06 + 0.55 * w2).toFixed(3) + ')'; ctx.fillRect(Math.round(wx - cx), Math.round(pTop + 3 - cy), 2, 1); }
      const mid = (tw.x0 + tw.x1) / 2; glow(mid - cx, 540 - cy, 30, '255,150,90', 0.06);
    }
    // the hot air rising
    for (const v of L.vents || []) {
      const x = v[0] * TS - cx, w = v[2] * TS, yTop = v[1] * TS - cy, yBot = (v[1] + v[3]) * TS - cy;
      const hg = ctx.createLinearGradient(0, yTop, 0, yBot); hg.addColorStop(0, 'rgba(255,150,90,0)'); hg.addColorStop(1, 'rgba(255,150,90,0.12)');
      ctx.fillStyle = hg; ctx.fillRect(Math.round(x), Math.round(yTop), w, Math.round(yBot - yTop));
      for (let k = 0; k < 3; k++) for (let y = yBot; y > yTop; y -= 3) {
        const u = ((yBot - y) / (yBot - yTop) + t * 0.4 + k * 0.33) % 1;
        if (u > 0.5) continue;
        ctx.fillStyle = 'rgba(255,210,170,' + (0.12 * (1 - u * 2)).toFixed(3) + ')';
        ctx.fillRect(Math.round(x + w / 2 + Math.sin(y * 0.09 + t * 3 + k * 2) * (w / 2 - 1)), Math.round(y), 1, 2);
      }
      for (let k = 0; k < 8; k++) { const u = (t * 0.22 + k / 8) % 1, my = yBot - u * (yBot - yTop); ctx.fillStyle = 'rgba(255,225,190,' + (0.6 * (1 - u)).toFixed(3) + ')'; ctx.fillRect(Math.round(x + ((k * 5) % w)), Math.round(my), 1, 1); }
      glow(x + w / 2, yBot - 2, 18, '255,140,80', 0.2 + 0.06 * Math.sin(t * 4));
    }
    // the hole: cold light rising out of The Deep, a mist spilling over its lip, the runes around it
    const h0 = A.hole[0] - cx, h1 = A.hole[1] - cx, fy = A.hole[2] - cy, hm = (h0 + h1) / 2;
    const sg = ctx.createLinearGradient(0, fy - 170, 0, fy); sg.addColorStop(0, 'rgba(120,150,240,0)'); sg.addColorStop(1, 'rgba(120,150,240,0.12)');
    ctx.fillStyle = sg; ctx.fillRect(Math.round(h0 + 4), Math.round(fy - 170), Math.round(h1 - h0 - 8), 170);
    for (let k = 0; k < 6; k++) { const u = (t * 0.12 + k / 6) % 1; glow(hm + Math.sin(t * 0.3 + k * 2) * 26, fy - 4 - u * 10, 22, '120,150,230', 0.08 * (1 - u)); }
    for (let wx = A.hole[0] - 70; wx < A.hole[1] + 70; wx += 4) {
      if (wx >= A.hole[0] - 2 && wx <= A.hole[1] + 2) continue;
      const k = 0.15 + 0.25 * Math.max(0, Math.sin(t * 1.5 - Math.abs(wx - (A.hole[0] + A.hole[1]) / 2) * 0.05));
      ctx.fillStyle = 'rgba(150,175,255,' + k.toFixed(3) + ')'; ctx.fillRect(Math.round(wx - cx), Math.round(fy + 2), 2, 1);
    }
    // motes drifting through the whole room
    if (!motes.length) for (let i = 0; i < 90; i++) motes.push({ x: 420 + Math.random() * 840, y: 80 + Math.random() * 470, s: 0.2 + Math.random() * 0.6, p: Math.random() * 6.28 });
    for (const m of motes) {
      m.y -= m.s * (st.dt || 0) * 6; if (m.y < 76) m.y = 550;
      const x = m.x + Math.sin(t * 0.3 * m.s + m.p) * 14 - cx, y = m.y - cy;
      if (x < 0 || x > LW || y < 0 || y > LH) continue;
      ctx.fillStyle = 'rgba(200,235,240,' + (0.25 + 0.3 * Math.sin(t * 1.7 + m.p)).toFixed(3) + ')'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    // a glyph ring turning around the shell, and an inner ring the other way
    for (let k = 0; k < 28; k++) {
      const gr = 66 + 16 * st.iris, a = k / 28 * Math.PI * 2 + t * 0.06, x = bx + Math.cos(a) * gr, y = by + Math.sin(a) * gr, h = 1 + (k * 7) % 3;
      ctx.fillStyle = 'rgba(150,230,215,' + (0.35 + 0.25 * st.iris).toFixed(3) + ')'; ctx.fillRect(Math.round(x), Math.round(y), 1, h); if (k % 3 === 0) ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    }
    for (let k = 0; k < 48; k++) { if (k % 6 === 5) continue; const a = k / 48 * Math.PI * 2 - t * 0.1, ir2 = 22 + 10.5 * st.iris; ctx.fillStyle = 'rgba(150,230,215,0.3)'; ctx.fillRect(Math.round(bx + Math.cos(a) * ir2), Math.round(by + Math.sin(a) * ir2), 1, 1); }
  }


  /* ---- THE PRIME: what the Guardian was keeping in. A living sphere in the colours of a Planetary Prime: two shells
     of short strokes turning against each other, green currents running round its bands, a sieve of light sweeping
     pole to pole that wakes only the prime-numbered strokes, motes it breathes out and draws back in. When a seeker
     wakes it swells and the face turned toward you parts, the way the Guardian's arms did. (iris 0 shut .. 1 open) */

    let a = 11; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const isPrime = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
    function shell(bands, per, keep, r) {
      const P = []; let idx = 0;
      for (let i = 0; i < bands; i++) {
        const lat = -Math.PI / 2 + (i + 0.5) / bands * Math.PI, n = Math.round(per * Math.cos(lat)) + 3;
        for (let j = 0; j < n; j++) {
          idx++;
          if (rnd() > keep) continue;
          const lon = (j + rnd() * 0.5) / n * Math.PI * 2;
          P.push({ x: Math.cos(lat) * Math.cos(lon) * r, y: Math.sin(lat) * r, z: Math.cos(lat) * Math.sin(lon) * r, lat: i / bands, lon, len: 1 + Math.floor(rnd() * 3), k: rnd(), prime: isPrime(idx), ph: rnd() * 6.28 });
        }
      }
      return P;
    }
    const OUTER = shell(44, 72, 0.85, 1), INNER = shell(22, 34, 0.75, 0.58);
    const MOTES = Array.from({ length: 70 }, () => ({ a: rnd() * 6.28, b: rnd() * 3.14 - 1.57, s: 0.2 + rnd() * 0.6, ph: rnd() }));
    const BACK = [26, 80, 46], GREENS = [[70, 200, 120], [48, 176, 96], [96, 220, 140], [60, 170, 140], [110, 210, 120]];
    const FRONT = [[150, 246, 180], [110, 232, 150], [200, 255, 210], [130, 250, 200], [90, 220, 140]];
    const SIEVE = [190, 255, 200];
    function drawPrime(ctx, bx, by, iris, t) {
      const breathe = Math.sin(t * 1.3), R = 66 * (1 + 0.04 * breathe) * (1 + 0.3 * iris), tilt = 0.36;
      const glow = 0.82 + 0.18 * breathe;
      const sieveLat = (t * 0.18) % 1.4 - 0.2;            // a band of light sweeping pole to pole
      const draw = (P, yaw, scale, depthBias, inner) => {
        const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt), out = [];
        for (const p of P) {
          const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
          const y2 = p.y * ct - z1 * st, z2 = p.y * st + z1 * ct;
          const zn = z2 / (inner ? 0.58 : 1), front = Math.max(0, zn), d = Math.hypot(x1, y2) / (inner ? 0.58 : 1);
          const push = 1 + iris * (inner ? 0.25 : 0.6) * front * front * (1 - Math.min(1, d));
          out.push([bx + x1 * R * scale * push, by + y2 * R * scale * push, zn + depthBias, p]);
        }
        return out;
      };
      const pts = draw(INNER, -t * 0.34, 1, -0.6, true).concat(draw(OUTER, t * 0.2, 1, 0, false));
      pts.sort((A, B) => A[2] - B[2]);
      ctx.save();
      for (const [x, y, z, p] of pts) {
        // a current: brightness running round each band, each band at its own speed
        const cur = Math.pow(0.5 + 0.5 * Math.sin(p.lon * 3 - t * (1.2 + p.lat * 1.6) + p.lat * 9), 6);
        const sieve = p.prime ? Math.max(0, 1 - Math.abs(p.lat - sieveLat) * 9) : 0;
        let c, al;
        if (z < -0.3) { c = BACK; al = 0.3 + 0.25 * (z + 1); }
        else if (z < 0.4) { c = GREENS[Math.floor(p.k * GREENS.length)]; al = 0.62; }
        else { c = FRONT[Math.floor(p.k * FRONT.length)]; al = 0.92; }
        const tw = 0.7 + 0.3 * Math.sin(t * 2.6 + p.ph);
        al = Math.min(1, al * glow * tw + cur * 0.5 + sieve);
        if (sieve > 0.05) c = SIEVE;
        ctx.globalCompositeOperation = cur > 0.5 || sieve > 0.05 ? 'lighter' : 'source-over';
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + al.toFixed(3) + ')';
        ctx.fillRect(Math.round(x), Math.round(y), z > 0.55 ? 2 : 1, z > 0.15 ? p.len : 1);   // the face nearest you in heavier strokes
        if (sieve > 0.5) { ctx.fillStyle = 'rgba(190,255,200,' + (0.25 * sieve).toFixed(3) + ')'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, p.len + 2); }
      }
      // motes: breathed out on the in-breath, drawn back in on the out-breath
      ctx.globalCompositeOperation = 'lighter';
      for (const m of MOTES) {
        const u = (t * 0.12 * m.s + m.ph) % 1, rr = R * (1.02 + 0.5 * Math.sin(u * Math.PI)), aa = m.a + t * 0.15 * m.s;
        const x = bx + Math.cos(aa) * Math.cos(m.b) * rr, y = by + Math.sin(m.b) * rr * 0.95;
        ctx.fillStyle = 'rgba(160,250,190,' + (0.6 * Math.sin(u * Math.PI)).toFixed(3) + ')'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      // a soft green bloom around it, and its heart
      const h = ctx.createRadialGradient(bx, by, R * 0.3, bx, by, R * 1.35); h.addColorStop(0, 'rgba(60,200,120,' + (0.10 * glow).toFixed(3) + ')'); h.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = h; ctx.fillRect(bx - R * 1.4, by - R * 1.4, R * 2.8, R * 2.8);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 36 + 10 * iris); g.addColorStop(0, 'rgba(60,140,240,' + (0.25 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(bx - 50, by - 50, 100, 100);
      ctx.restore();
    }
  
  global.DwellerArchive = { drawBack, lift, drawFront, drawPrime };
})(typeof globalThis !== 'undefined' ? globalThis : this);
