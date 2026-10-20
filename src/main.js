/* DWELLER — game shell: loop, input, camera, the map of the descent, screens. */
(function () {
  'use strict';
  const D = Dweller, R = DwellerRender, A = DwellerAudio;
  const TS = D.TS, IN = D.IN, EV = D.EV;
  const PAL = R.PAL;
  const LEVELS = window.DWELLER_LEVELS || [window.DWELLER_LEVEL];
  const NL = 6;                                   // six levels, six slivers
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const NAMES = ['THE DESCENT', 'THE MYCELIUM', 'THE GLASS GARDEN', 'THE FOUNDRY', 'EMBER DEEP', 'THE HEART', 'THE CORE'];
  const CORE = 6;                                 // the final depth behind the door
  // what each sliver does to the Guardian when it is set
  const SLIVER_CARD = ['I  IT LEARNS TO LOOK', 'II  THE ROOM BREATHES', 'III  ITS GAZE SPLITS', 'IV  IT KEEPS THE BEAT', 'V  IT BURNS LIKE A SUN', 'VI  ITS HEART STUMBLES'];

  const canvas = document.getElementById('c');
  const gctx = canvas.getContext('2d', { alpha: false });
  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { alpha: false });

  let world = null, S = null;           // world, player state
  let cur = -1;                         // loaded level index
  let mode = 'loading';                 // loading | title | map | play | pause | win
  let LW = 480, LH = 270, SC = 3, DPR = 1;
  let camX = 0, camY = 0;
  let simAcc = 0, lastT = 0, gameTime = 0, runTicks = 0, frameDt = 0.016;
  let sectionIdx = -1, cardT = 99, cardText = '';
  let shake = 0, flash = 0, deathFade = 0;
  let touchMode = false, speedMul = 1, replay = null, replayI = 0;
  let stepDist = 0, beamPrev = {};
  let titleT = 0, winT = 0, err = '', seekerCardT = 99, newBest = false, winTime = 0;
  let sel = 0, mapT = 0, mapMsg = '', mapMsgT = 99, flare = null, fuseT = -1;
  const mparts = [];

  /* ------------------------------------------------------------ progress */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  const P = { beaten: [false, false, false, false, false, false], best: [0, 0, 0, 0, 0, 0], comp: false, cp: {}, fused: false, core: false, coreBest: 0, seen: {} };
  function loadProgress() {
    try {
      const j = JSON.parse(lsGet('dweller.v2') || 'null');
      if (j && Array.isArray(j.beaten)) {
        for (let i = 0; i < NL; i++) { P.beaten[i] = !!j.beaten[i]; P.best[i] = +(j.best && j.best[i]) || 0; }
        P.comp = !!j.comp; P.cp = j.cp && typeof j.cp === 'object' ? j.cp : {}; P.fused = !!j.fused; P.seekerId = j.seekerId; P.core = !!j.core; P.coreBest = +j.coreBest || 0; P.seen = j.seen && typeof j.seen === 'object' ? j.seen : {};
        return;
      }
    } catch (e) { }
    // carry over a save from the single-level release
    const b = parseFloat(lsGet('dweller.best') || '');
    if (b > 0) { P.beaten[0] = true; P.best[0] = b; }
    try { const v = JSON.parse(lsGet('dweller.v1') || 'null'); if (v && v.cp > 0) P.cp[0] = v; } catch (e) { }
  }
  function saveProgress() { lsSet('dweller.v2', JSON.stringify(P)); }
  /* one of ten SEEKER NET seekers sleeps in the mycelium; which one is rolled once per save */
  function pickSeeker() {
    const ids = R.SEEKERS.map(q => q.id);
    if (!ids.includes(P.seekerId)) { P.seekerId = P.comp ? 1895 : ids[Math.floor(Math.random() * ids.length)]; saveProgress(); }
    R.setSeeker(P.seekerId);
  }
  function unlocked(i) { return i === 0 || (i < NL && P.beaten[i - 1]); }
  function built(i) { return i < LEVELS.length && !!LEVELS[i]; }
  function count() { return P.beaten.filter(Boolean).length; }
  function writeTether() { P.cp[cur] = { cp: S.cp, ticks: runTicks, deaths: S.deaths }; saveProgress(); }

  /* ------------------------------------------------------------ input */
  const keys = Object.create(null);
  const touch = { L: false, R: false, J: false, D: false, E: false };
  const pad = { L: false, R: false, J: false, D: false, E: false };
  const KEYMAP = {
    ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R',
    ArrowUp: 'J', KeyW: 'J', Space: 'J', KeyZ: 'J', KeyK: 'J',
    ArrowDown: 'D', KeyS: 'D', ShiftLeft: 'D', ShiftRight: 'D', KeyX: 'D', KeyJ: 'D', ControlLeft: 'D',
    KeyE: 'E', KeyC: 'E', KeyL: 'E',
  };
  let latch = 0;                         // taps shorter than a frame still reach the simulation once
  const LATCH = { J: IN.J, D: IN.D, E: IN.E };
  function inputMask() {
    let m = latch;
    if (keys.L || touch.L || pad.L) m |= IN.L;
    if (keys.R || touch.R || pad.R) m |= IN.R;
    if (keys.J || touch.J || pad.J) m |= IN.J;
    if (keys.D || touch.D || pad.D) m |= IN.D;
    if (keys.E || touch.E || pad.E) m |= IN.E;
    return m;
  }
  function audioInit() { try { A.Live.init(); } catch (e) { } }

  function keyCode(e) {
    if (e.code && e.code !== 'Unidentified') return e.code;
    const k = (e.key || '').toLowerCase();
    const m = { n: 'KeyN', p: 'KeyP', q: 'KeyQ', e: 'KeyE', escape: 'Escape', ' ': 'Space', enter: 'Enter', m: 'KeyM', r: 'KeyR', f: 'KeyF', a: 'KeyA', d: 'KeyD', w: 'KeyW', s: 'KeyS', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', backspace: 'Backspace' };
    return m[k] || '';
  }
  addEventListener('keydown', (ev) => {
    const e = { code: keyCode(ev), repeat: ev.repeat, metaKey: ev.metaKey, altKey: ev.altKey, preventDefault() { ev.preventDefault(); } };
    if (e.metaKey || e.altKey) return;
    const k = KEYMAP[e.code];
    if (k) { if (!e.repeat && LATCH[k] && mode === 'play') latch |= LATCH[k]; keys[k] = true; e.preventDefault(); }
    if (e.code === 'Backspace' || e.code === 'Tab') e.preventDefault();
    if (e.repeat && mode !== 'map') return;
    audioInit();
    if (mode === 'title') {
      if (['Space', 'Enter', 'ArrowUp', 'KeyW', 'ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'KeyZ', 'KeyK', 'ArrowDown', 'KeyS'].includes(e.code)) toMap();
    } else if (mode === 'map') {
      mapKey(e.code);
    } else if (mode === 'win') {
      if (e.code === 'KeyN') { startLevel(cur, true); return; }
      if (e.code === 'Escape' || e.code === 'KeyQ') { toMap(); return; }
      if (winT > 2.5 && (e.code === 'Enter' || e.code === 'Space')) toMap();
    } else if (mode === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') setPause(true);
      if (e.code === 'KeyR' && !S.dead && !S.won) { S.ex = 1; S.grace = 0; }   // give up: let the light take you back to the tether
    } else if (mode === 'pause') {
      if (e.code === 'KeyN') { A.Live.setPaused(false); startLevel(cur, true); return; }
      if (e.code === 'KeyQ' || e.code === 'Backspace') { A.Live.setPaused(false); toMap(); return; }
      if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter' || e.code === 'Space') setPause(false);
    }
    if (e.code === 'KeyM') A.Live.toggleMute();
    if (e.code === 'KeyF') toggleFull();
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[keyCode(e)]; if (k) { keys[k] = false; e.preventDefault(); } });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (mode === 'play') setPause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') setPause(true); });

  function toggleFull() {
    try {
      if (!document.fullscreenElement) (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || function () { }).call(document.documentElement);
      else (document.exitFullscreen || document.webkitExitFullscreen || function () { }).call(document);
    } catch (e) { }
  }
  function grabFocus() { try { window.focus(); canvas.focus({ preventScroll: true }); } catch (e) { } }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && mode === 'play') setPause(true); });
  document.addEventListener('webkitfullscreenchange', () => { if (!document.webkitFullscreenElement && mode === 'play') setPause(true); });
  function setPause(p) {
    if (p && mode === 'play') { mode = 'pause'; grabFocus(); A.Live.setPaused(true); for (const k in keys) keys[k] = false; }
    else if (!p && mode === 'pause') { mode = 'play'; A.Live.setPaused(false); lastT = performance.now(); }
  }

  /* touch controls */
  const tbtn = {};
  function buildTouchUI() {
    const root = document.getElementById('touch');
    if (!root) return;
    const mk = (id, label) => {
      const b = document.createElement('div'); b.className = 'tb'; b.id = 'tb' + id; b.textContent = label; root.appendChild(b); tbtn[id] = b;
      const set = (v, e) => { if (v && LATCH[id]) latch |= LATCH[id]; touch[id] = v; b.classList.toggle('on', v); if (e) e.preventDefault(); };
      const active = new Set();
      b.addEventListener('pointerdown', (e) => { touchMode = true; audioInit(); active.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (x) { } set(true, e); });
      const up = (e) => { active.delete(e.pointerId); if (!active.size) set(false, e); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    mk('L', '<'); mk('R', '>'); mk('J', 'JUMP'); mk('D', 'ROLL'); mk('E', 'SEEK');
    const pb = document.createElement('div'); pb.className = 'tb small'; pb.id = 'tbP'; pb.textContent = 'II'; root.appendChild(pb);
    pb.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); if (mode === 'play') setPause(true); else if (mode === 'pause') setPause(false); });
    addEventListener('touchstart', () => { if (!touchMode) { touchMode = true; } document.body.classList.add('touch'); }, { passive: true });
  }
  function syncTouchUI() {
    const playing = mode === 'play' || mode === 'pause';
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('cmp', playing && !!(S && S.cmp));
  }
  canvas.addEventListener('pointerdown', (e) => {
    audioInit(); grabFocus();
    if (e.pointerType === 'touch') { touchMode = true; document.body.classList.add('touch'); }
    const r = canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (mode === 'title') toMap();
    else if (mode === 'map') mapTap(fx * LW, fy * LH);
    else if (mode === 'pause') {
      if (e.pointerType !== 'touch') { setPause(false); return; }
      if (fy < 0.3) { A.Live.setPaused(false); toMap(); }
      else if (fy > 0.68) { A.Live.setPaused(false); startLevel(cur, true); }
      else setPause(false);
    }
    else if (mode === 'win' && winT > 2.5) toMap();
  });

  /* gamepad */
  const padPrev = {};
  function pollPad() {
    pad.L = pad.R = pad.J = pad.D = pad.E = false;
    let gps; try { gps = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return; }
    for (const g of gps) {
      if (!g || !g.connected) continue;
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0, b = (i) => g.buttons[i] && g.buttons[i].pressed;
      if (ax < -0.4 || b(14)) pad.L = true;
      if (ax > 0.4 || b(15)) pad.R = true;
      if (b(0) || b(12) || ay < -0.7) pad.J = true;
      if (b(1) || b(13) || b(6) || b(7) || ay > 0.7) pad.D = true;
      if (b(2) || b(3) || b(4) || b(5)) pad.E = true;
      const edge = (name, v) => { const was = padPrev[name]; padPrev[name] = v; return v && !was; };
      if (edge('start', b(9))) { if (mode === 'play') setPause(true); else if (mode === 'pause') setPause(false); else if (mode === 'title') toMap(); else if (mode === 'map') mapKey('Enter'); else if (mode === 'win' && winT > 2.5) toMap(); }
      if (mode === 'title' && edge('a', b(0))) toMap();
      else if (mode === 'map') {
        if (edge('a', b(0))) mapKey('Enter');
        if (edge('up', b(12) || ay < -0.6 || ax < -0.6)) mapKey('ArrowUp');
        if (edge('dn', b(13) || ay > 0.6 || ax > 0.6)) mapKey('ArrowDown');
        if (edge('b', b(1))) mapKey('Escape');
      } else { edge('a', b(0)); edge('up', false); edge('dn', false); edge('b', b(1)); }
      if (mode === 'win' && winT > 2.5 && edge('a2', b(0))) toMap();
    }
  }

  /* ------------------------------------------------------------ layout */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(2, Math.round(innerWidth * DPR)), ch = Math.max(2, Math.round(innerHeight * DPR));
    canvas.width = cw; canvas.height = ch;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    SC = Math.max(1, Math.round(ch / (cur === CORE && mode !== 'map' && mode !== 'title' ? 360 : 230)));   // the Guardian's arena is seen from further back
    LW = Math.ceil(cw / SC) + 1; LH = Math.ceil(ch / SC) + 1;
    off.width = LW; off.height = LH;
    octx.imageSmoothingEnabled = false; gctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize);

  /* ------------------------------------------------------------ game flow */
  function loadLevel(i) {
    if (cur === i && world) return;
    const L = LEVELS[i];
    world = D.makeWorld(L);
    R.prepare(world, L.theme, i);
    cur = i;
  }
  let scFor = -1;
  function fitView() { const k = cur === CORE && mode !== 'map' && mode !== 'title' ? 1 : 0; if (k !== scFor) { scFor = k; resize(); } }
  function startLevel(i, fresh) {
    audioInit();
    loadLevel(i);
    if (fresh) { delete P.cp[i]; saveProgress(); }
    S = D.newState(world, { companion: P.comp }); runTicks = 0; R.parts.length = 0; R.clearGuardian(); A.Live.boss = null; R.resetTethers(); beamPrev = {}; deathFade = 0; flash = 0; shake = 0;
    seekerCardT = 99; newBest = false;
    const sv = P.cp[i];
    if (!fresh && sv && sv.cp > 0 && world.checks[sv.cp]) {
      const c = world.checks[sv.cp];
      S.cp = sv.cp; S.cpX = c.x; S.cpY = c.y; S.x = c.x - D.C.W / 2; S.y = c.y - D.C.H; S.grace = D.C.GRACE;
      S.cmpX = c.x - 9; S.cmpY = c.y - 22;
      S.deaths = sv.deaths || 0; runTicks = sv.ticks || 0;
      for (let k = 1; k <= sv.cp; k++) R.markTether(k, -99);
    }
    mode = 'play'; sectionIdx = -1; cardT = 99; snapCamera();
    A.Live.setTheme(i);
    A.Live.sfx('start');
    A.Live.setPaused(false);
    syncTouchUI();
  }
  function toMap(focus) {
    mode = 'map'; mapT = 0; mapMsgT = 99;
    if (focus !== undefined) sel = focus;
    A.Live.setTheme(-1); A.Live.setMood(0.12, 0);
    syncTouchUI();
  }
  function sectionAt(tx) {
    const ss = world.sections;
    for (let i = 0; i < ss.length; i++) if (tx >= ss[i].x0 && tx < ss[i].x1) return i;
    return ss.length - 1;
  }
  function updateSection() {
    const i = sectionAt((S.x + 2.5) / TS);
    if (i !== sectionIdx) {
      sectionIdx = i;
      const sec = world.sections[i];
      // the name of a section shows only the first time you ever reach it
      const seen = P.seen[cur] || (P.seen[cur] = '');
      if (seen.indexOf('|' + i + '|') < 0) { cardText = sec.title; cardT = 0; P.seen[cur] = seen + '|' + i + '|'; saveProgress(); }
      const m = sec.music || { e: 0.2, root: 0 };
      A.Live.setMood(m.e, m.root);
    }
  }

  /* ------------------------------------------------------------ the map of the descent */
  function mapLayout() {
    const narrow = LW < 330;
    const top = 28, bot = narrow ? LH - 74 : LH - 30;
    const pathX = narrow ? Math.round(LW / 2) : Math.round(Math.min(LW * 0.36, 190));
    const amp = narrow ? Math.min(28, LW * 0.2) : 34;
    const span = bot - top - 34;
    const nodes = [];
    for (let i = 0; i < NL; i++) nodes.push({ x: Math.round(pathX + Math.sin(i * 1.7 + 0.6) * amp), y: Math.round(top + span * i / (NL - 1)) });
    nodes.push({ x: pathX, y: Math.round(bot) });   // the door
    return { nodes, narrow, infoX: narrow ? Math.round(LW / 2) : Math.round(pathX + amp + 34), infoY: narrow ? LH - 54 : Math.round(LH * 0.30) };
  }
  function mapKey(code) {
    if (fuseT >= 0) return;
    if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(code)) { sel = Math.max(0, sel - 1); A.Live.sfx('ui'); mapMsgT = 99; }
    else if (['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(code)) { sel = Math.min(NL, sel + 1); A.Live.sfx('ui'); mapMsgT = 99; }
    else if (['Space', 'Enter', 'KeyZ', 'KeyK'].includes(code)) chooseNode(sel, false);
    else if (code === 'KeyN') chooseNode(sel, true);
    else if (code === 'Escape' || code === 'Backspace') { mode = 'title'; titleT = 0; syncTouchUI(); }
  }
  function chooseNode(i, fresh) {
    if (i >= NL) {
      if (count() >= NL && P.fused && built(CORE)) { startLevel(CORE, fresh); return; }
      mapMsg = count() >= NL ? 'THE DOOR IS OPENING' : 'THE DOOR WAITS FOR ALL SIX SLIVERS';
      mapMsgT = 0; A.Live.sfx(count() >= NL ? 'check' : 'nope'); return;
    }
    if (!built(i)) { mapMsg = 'THIS DEPTH IS NOT YET DUG'; mapMsgT = 0; A.Live.sfx('nope'); return; }
    if (!unlocked(i)) { mapMsg = 'BEAT ' + ROMAN[i - 1] + ' TO OPEN THE WAY'; mapMsgT = 0; A.Live.sfx('nope'); return; }
    startLevel(i, fresh);
  }
  function mapTap(x, y) {
    if (fuseT >= 0) return;
    const L = mapLayout();
    let best = -1, bd = 18;
    L.nodes.forEach((n, i) => { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) return;
    if (best === sel) chooseNode(best, false); else { sel = best; A.Live.sfx('ui'); mapMsgT = 99; }
  }
  function nodeCol(i) { return R.SHARDS[i]; }
  function drawMap(ctx, dt) {
    const t = mapT;
    const L = mapLayout(), N = L.nodes;
    ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, LW, LH);
    // faint strata: the deeper, the warmer
    const TN = ['descent', 'mycelium', 'glass', 'foundry', 'ember', 'heart'];
    const grd = ctx.createLinearGradient(0, N[0].y, 0, N[NL].y);
    for (let i = 0; i < NL; i++) {
      const c = R.THEMES[TN[i]].bgBot, a = P.beaten[i] || unlocked(i) ? 0.30 : 0.12;
      grd.addColorStop(i / NL, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')');
    }
    grd.addColorStop(1, 'rgba(20,16,26,0.2)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, LW, LH);
    // the path
    for (let i = 0; i < NL; i++) {
      const a = N[i], b = N[i + 1];
      const lit = P.beaten[i];
      const steps = Math.max(4, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let k = 1; k < steps; k++) {
        const u = k / steps, x = Math.round(a.x + (b.x - a.x) * u), y = Math.round(a.y + (b.y - a.y) * u);
        if (lit) { ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 3 - k * 0.5 - i); ctx.fillStyle = nodeCol(i); }
        else { ctx.globalAlpha = 0.5; ctx.fillStyle = '#2a2f3c'; }
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    // the orbs
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < NL; i++) {
      if (!P.beaten[i] || (fuseT >= 0)) continue;
      const n = N[i], rgb = hexRGB(nodeCol(i));
      const fl = flare && flare.i === i ? Math.max(0, Math.min(1, 1 - flare.t / 1.6)) : 0;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 18 + fl * 30);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (0.35 + 0.5 * fl).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.fillRect(n.x - 50, n.y - 50, 100, 100);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < NL; i++) {
      const n = N[i];
      const open = built(i) && unlocked(i);
      const r = 4;
      if (P.beaten[i]) {
        const pulse = 0.85 + 0.15 * Math.sin(t * 2 + i);
        disc(ctx, n.x, n.y, r + 1, R.shade(nodeCol(i), -0.35));
        disc(ctx, n.x, n.y, r, nodeCol(i));
        disc(ctx, n.x - 1, n.y - 1, 1.6, R.shade(nodeCol(i), 0.6 * pulse));
      } else if (open) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 4);
        ring(ctx, n.x, n.y, r, 'rgba(214,226,236,' + pulse.toFixed(3) + ')');
        disc(ctx, n.x, n.y, 1.5, 'rgba(214,226,236,' + (0.4 * pulse).toFixed(3) + ')');
      } else {
        ring(ctx, n.x, n.y, r, '#2c313d');
      }
      // numeral
      R.drawText(ctx, ROMAN[i], n.x - 10, n.y - 3, P.beaten[i] ? '#cfd6e0' : open ? '#8a919e' : '#3c4250', 1, 'right');
      // the secret of the mycelium
      if (i === 1 && (P.comp || P.beaten[1])) {
        if (P.comp) R.drawMini(ctx, n.x + 13, n.y - 1, t, 'on', 1);
        else { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2); R.drawText(ctx, '?', n.x + 9, n.y - 3, '#8a919e', 1); ctx.globalAlpha = 1; }
      }
    }
    // the door and the crystal it waits for
    const dn = N[NL];
    const all = count() >= NL;
    const fusing = fuseT >= 0, fu = fusing ? Math.min(1, fuseT / 2.2) : 0;
    const open = all && (P.fused || (fusing && fuseT > 2.6));
    drawDoor(ctx, dn.x, dn.y, open, t, fusing ? Math.max(0, (fuseT - 2.2) / 1.2) : (P.fused ? 1 : 0));
    const have = P.beaten.map((b, i) => b && (!fusing || fu >= 1));
    R.drawGem(ctx, dn.x, dn.y - 10, 0.6, have, t, all);
    if (fusing) {
      for (let i = 0; i < NL; i++) {
        if (fu >= 1) break;
        const n = N[i], e = fu * fu * (3 - 2 * fu);
        const x = n.x + (dn.x - n.x) * e, y = n.y + (dn.y - 10 - n.y) * e - Math.sin(e * Math.PI) * 14;
        R.drawShard(ctx, x, y, nodeCol(i), t, 0, 0.55);
      }
      if (fuseT > 2.2 && fuseT < 2.9) { ctx.globalAlpha = Math.max(0, 1 - (fuseT - 2.2) / 0.7); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1; }
    }
    // selection
    const sn = N[sel];
    const bs = sel === NL ? 18 : 8, pul = Math.round(Math.sin(t * 5) * 1);
    ctx.fillStyle = PAL.gold;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = sn.x + sx * (bs + pul), y = (sel === NL ? sn.y - 8 : sn.y) + sy * (bs + pul);
      ctx.fillRect(x - (sx > 0 ? 2 : 0), y, 3, 1); ctx.fillRect(x, y - (sy > 0 ? 2 : 0), 1, 3);
    }
    drawMapInfo(ctx, L);
    // particles
    for (let i = mparts.length - 1; i >= 0; i--) {
      const p = mparts[i]; p.life -= dt; if (p.life <= 0) { mparts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 20 * dt;
      ctx.globalAlpha = Math.min(1, p.life / p.max); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }
  function disc(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.fill(); }
  function ring(ctx, x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2); ctx.stroke(); }
  function drawDoor(ctx, x, y, open, t, k) {
    const w = 14, h = 34, top = y - h + 8;
    ctx.fillStyle = '#12141c'; ctx.beginPath(); ctx.moveTo(x - w, y + 8); ctx.lineTo(x - w, top + 8); ctx.quadraticCurveTo(x, top - 8, x + w, top + 8); ctx.lineTo(x + w, y + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = open ? 'rgba(240,240,255,0.7)' : '#2c313d'; ctx.lineWidth = 1; ctx.stroke();
    if (open) {
      const ig = ctx.createLinearGradient(0, top, 0, y + 8);
      ig.addColorStop(0, 'rgba(255,255,255,' + (0.30 * k).toFixed(3) + ')'); ig.addColorStop(1, 'rgba(180,160,255,' + (0.10 * k).toFixed(3) + ')');
      ctx.fillStyle = ig; ctx.beginPath(); ctx.moveTo(x - w + 2, y + 8); ctx.lineTo(x - w + 2, top + 9); ctx.quadraticCurveTo(x, top - 5, x + w - 2, top + 9); ctx.lineTo(x + w - 2, y + 8); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const g = ctx.createRadialGradient(x, y - 2, 0, x, y - 2, 26);
        const a = 0.12 * k * (0.7 + 0.3 * Math.sin(t * 2 + i));
        g.addColorStop(0, 'rgba(' + hexRGB(R.SHARDS[i]) + ',' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + hexRGB(R.SHARDS[i]) + ',0)');
        ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, 60, 50);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = '#2c313d'; ctx.fillRect(x - 1, y + 4, 3, 3);
    }
  }
  function drawMapInfo(ctx, L) {
    const x = L.infoX, al = L.narrow ? 'center' : 'left';
    let y = L.infoY;
    const line = (txt, col, sc) => { R.drawText(ctx, txt, x, y, col, sc || 1, al); y += (sc || 1) * 7 + 5; };
    R.drawText(ctx, 'DWELLER', L.narrow ? LW / 2 : x, 10, '#5d6474', 1, L.narrow ? 'center' : 'left');
    if (!L.narrow) R.drawText(ctx, count() + ' / 6  SLIVERS', LW - 8, 10, '#5d6474', 1, 'right');
    if (sel < NL) {
      const i = sel;
      line(ROMAN[i] + '  ' + NAMES[i], P.beaten[i] ? R.SHARDS[i] : unlocked(i) && built(i) ? PAL.snow : '#5d6474', L.narrow ? 1 : 2);
      if (!built(i)) line('NOT YET DUG', '#5d6474');
      else if (!unlocked(i)) line('SEALED  -  BEAT ' + ROMAN[i - 1] + ' FIRST', '#5d6474');
      else {
        if (P.beaten[i]) line('SLIVER FOUND' + (P.best[i] ? '    BEST  ' + fmtTime(P.best[i]) : ''), '#a9b2c0');
        else line('THE SLIVER STILL GLOWS BELOW', '#8a919e');
        const sv = P.cp[i];
        const blink = 0.6 + 0.4 * Math.sin(mapT * 3);
        ctx.globalAlpha = blink;
        line(touchMode ? 'TAP AGAIN TO DESCEND' : sv && sv.cp > 0 ? 'SPACE  CONTINUE FROM TETHER ' + sv.cp : 'SPACE  DESCEND', PAL.gold);
        ctx.globalAlpha = 1;
        if (sv && sv.cp > 0 && !touchMode) line('N  START FROM THE TOP', '#8a919e');
        if (i === 1 && !P.comp && P.beaten[1]) line('SOMETHING WAITS BEHIND A FALSE WALL', '#6b7280');
      }
    } else {
      const open = count() >= NL && P.fused, sv = P.cp[CORE];
      line(open ? 'VII  THE CORE' : 'THE DOOR', count() >= NL ? PAL.snow : '#8a919e', L.narrow ? 1 : 2);
      line(count() >= NL ? (P.core ? 'THE GUARDIAN IS GONE' : 'A GUARDIAN WAITS BELOW') : count() + ' OF 6 SLIVERS', count() >= NL ? '#d6dbe4' : '#8a919e');
      if (open && P.coreBest) line('BEST  ' + fmtTime(P.coreBest), '#8a919e');
      if (open) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(mapT * 4); line(touchMode ? 'TAP AGAIN TO DESCEND' : sv && sv.cp > 0 ? 'SPACE  CONTINUE FROM THE THIRD SLIVER' : 'SPACE  DESCEND', PAL.gold); ctx.globalAlpha = 1; if (sv && sv.cp > 0 && !touchMode) line('N  START FROM THE TOP', '#8a919e'); }
      else line(count() >= NL ? 'THE DOOR IS OPENING' : 'BEAT EVERY LEVEL TO OPEN IT', '#6b7280');
    }
    if (P.comp && !L.narrow) { y += 4; R.drawMini(ctx, x + 5, y + 4, mapT, 'on', 1); R.drawText(ctx, 'SEEKER  -  E  ECLIPSE A LIGHT', x + 14, y + 1, '#7f9aa6', 1); y += 14; }
    if (mapMsgT < 3) { ctx.globalAlpha = Math.min(1, (3 - mapMsgT) * 2); R.drawText(ctx, mapMsg, L.narrow ? LW / 2 : x, L.narrow ? LH - 16 : y + 6, '#d6b98a', 1, L.narrow ? 'center' : 'left'); ctx.globalAlpha = 1; }
    if (!touchMode && !L.narrow) R.drawText(ctx, 'ARROWS  CHOOSE     SPACE  DESCEND     ESC  TITLE', LW - 8, LH - 12, '#3f4554', 1, 'right');
  }
  function mapFrame(dt) {
    mapT += dt; mapMsgT += dt;
    if (flare) {
      flare.t += dt;
      if (flare.pending && flare.t > 0) {
        flare.pending = false; A.Live.sfx('check');
        const n = mapLayout().nodes[flare.i];
        for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, sp = 8 + Math.random() * 30; mparts.push({ x: n.x, y: n.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: 0.8 + Math.random(), max: 1.8, c: k % 2 ? R.SHARDS[flare.i] : '#ffffff' }); }
      }
      if (flare.t > 2) flare = null;
    }
    if (fuseT >= 0) {
      fuseT += dt;
      if (fuseT > 2.2 && !P.fused) { P.fused = true; saveProgress(); A.Live.sfx('win'); }
      if (fuseT > 4) fuseT = -1;
    } else if (count() >= NL && !P.fused && !flare) { fuseT = 0; sel = NL; }
  }

  /* ------------------------------------------------------------ camera */
  function camTarget() {
    const px = S.x + 2.5, py = S.y + S.h * 0.5;
    const look = Math.max(-1, Math.min(1, S.vx / 72)) * 26;
    let tx = px - LW / 2 + look;
    let ty = py - LH * 0.56 + (S.vy > 120 ? 22 : 0) + (S.wallDir ? -6 : 0);
    const B = world.boss;
    if (B && !S.bBurst) {
      // lean the view toward the Guardian, as far as keeps the Dweller well inside the frame
      const gx = B.x - LW / 2, gy = B.y - LH / 2, mx = LW * 0.32, my = LH * 0.30;
      tx = Math.max(px - LW / 2 - mx, Math.min(px - LW / 2 + mx, tx + (gx - tx) * 0.55));
      ty = Math.max(py - LH / 2 - my, Math.min(py - LH / 2 + my, ty + (gy - ty) * 0.55));
    }
    const maxX = world.W * TS - LW, maxY = world.H * TS - LH + 24;
    tx = Math.max(0, Math.min(Math.max(0, maxX), tx));
    ty = Math.max(-24, Math.min(Math.max(-24, maxY), ty));
    return [tx, ty];
  }
  function snapCamera() { const t = camTarget(); camX = t[0]; camY = t[1]; }
  function updateCamera(dt) {
    const t = camTarget();
    const kx = 1 - Math.exp(-dt * 5.5), ky = 1 - Math.exp(-dt * (S.vy > 80 ? 7 : 4.2));
    if (S.dead && S.deadT < 4) return;
    camX += (t[0] - camX) * kx; camY += (t[1] - camY) * ky;
    if (S.ev & EV.RESPAWN) snapCamera();
  }

  /* ------------------------------------------------------------ events -> sound & particles */
  function handleEvents(ev, st) {
    const L = A.Live;
    const th = R.theme;
    if (ev & EV.JUMP) { L.sfx('jump'); puff(st, 5, 0.6); }
    if (ev & EV.WJUMP) { L.sfx('wjump'); puff(st, 4, 0.7); }
    if (ev & EV.LAND) { const v = Math.min(1, st.landV / 200); L.sfx('land', { v: 0.35 + v }); puff(st, 3 + Math.round(v * 5), 0.6 + v); if (ev & EV.HARDLAND) shake = Math.max(shake, 1.2); }
    if (ev & EV.ROLL) { L.sfx('roll'); puff(st, 4, 0.8); }
    if (ev & EV.DEATH) {
      L.sfx('death'); shake = 3; flash = 1; deathFade = 1;
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * 6.283, sp = 20 + Math.random() * 70;
        R.spawn(st.deathX, st.deathY - 5, Math.cos(a) * sp, Math.sin(a) * sp - 20, 0.5 + Math.random() * 0.9, i % 3 ? PAL.gold : PAL.snow, 1, 90, false);
      }
    }
    if (ev & EV.RESPAWN) { L.sfx('respawn'); deathFade = 0; for (let i = 0; i < 18; i++) R.spawn(st.x + 2.5 + (Math.random() - 0.5) * 8, st.y + 10 - Math.random() * 10, (Math.random() - 0.5) * 12, -20 - Math.random() * 30, 0.8, th.lamp[2], 1, -10, true); }
    if (ev & EV.CHECK) {
      L.sfx('check'); R.markTether(st.cp, performance.now() / 1000);
      writeTether();
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, sp = 10 + Math.random() * 40; R.spawn(st.cpX, st.cpY - 12, Math.cos(a) * sp, Math.sin(a) * sp - 25, 1 + Math.random(), i % 2 ? th.lamp[1] : th.lamp[2], 1, 20, true); }
    }
    if (ev & EV.SEEKER) {
      L.sfx('seeker'); flash = 0.6; seekerCardT = 0;
      if (!P.comp) { P.comp = true; saveProgress(); }
      for (let i = 0; i < 50; i++) { const a = Math.random() * 6.283, sp = 10 + Math.random() * 45; R.spawn(st.cmpX, st.cmpY, Math.cos(a) * sp, Math.sin(a) * sp - 10, 0.8 + Math.random(), i % 2 ? '#5daa99' : '#d5f8fc', 1, 10, true); }
      syncTouchUI();
    }
    if (ev & EV.BOUNCE) { L.sfx('bounce'); R.noteBounce(st.x + 2.5, st.y + st.h, gameTime); puff(st, 6, 1); }
    if (ev & EV.HUSH) { L.sfx('hush'); const q = world.switches[st.hushI]; for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283, sp = 8 + Math.random() * 24; R.spawn(q.x, q.y - 4, Math.cos(a) * sp, Math.sin(a) * sp - 15, 0.8 + Math.random() * 0.6, th.lamp[2], 1, 10, true); } }
    if (ev & EV.GRAB) L.sfx('step', { v: 0.6 });
    if (ev & EV.ECLIPSE) L.sfx('eclipse');
    if (ev & EV.ECLEND) L.sfx('eclend');
    if (ev & EV.ECLFAIL) L.sfx('nope');
    if (ev & EV.SLIVER) {
      const A0 = world.boss.alc[st.sliverI], col = R.SHARDS[st.sliverI];
      L.sfx('check'); L.sfx('hush'); flash = 0.7; shake = 1.5; cardText = SLIVER_CARD[st.sliverI]; cardT = 0;
      for (let i = 0; i < 70; i++) { const a = Math.random() * 6.283, sp = 15 + Math.random() * 60; R.spawn(A0.x, A0.y - 12, Math.cos(a) * sp, Math.sin(a) * sp - 20, 1 + Math.random(), i % 3 ? col : '#ffffff', 1, 20, true); }
    }
    if (ev & EV.THROES) { L.sfx('caught', { v: 1.4 }); shake = 4; }
    if (ev & EV.BURST) { R.guardianBurst(world, st); L.sfx('win'); L.sfx('death'); flash = 2; shake = 6; cardText = 'THE GUARDIAN IS GONE  -  FALL'; cardT = 0; }
    if (ev & EV.WIN && cur === CORE) {
      L.sfx('win'); flash = 2; shake = 2;
      const t = runTicks / D.TICK; winTime = t;
      newBest = !P.coreBest || t < P.coreBest; if (newBest) P.coreBest = t;
      P.core = true; delete P.cp[cur]; saveProgress(); sel = NL;
    } else if (ev & EV.WIN) {
      L.sfx('win'); flash = 1.5; shake = 2;
      const g = world.goal, col = R.SHARDS[cur];
      for (let i = 0; i < 160; i++) { const a = Math.random() * 6.283, sp = 15 + Math.random() * 90; R.spawn(g.x, g.y, Math.cos(a) * sp, Math.sin(a) * sp, 1.5 + Math.random() * 2, i % 3 ? col : '#ffffff', 1 + (i % 4 === 0 ? 1 : 0), 14, true); }
      const t = runTicks / D.TICK; winTime = t;
      const first = !P.beaten[cur];
      newBest = !P.best[cur] || t < P.best[cur];
      if (newBest) P.best[cur] = t;
      P.beaten[cur] = true; delete P.cp[cur]; saveProgress();
      if (first) flare = { i: cur, t: -0.4, pending: true };
      sel = cur + 1 < NL && built(cur + 1) ? cur + 1 : cur;
    }
  }
  function puff(st, n, k) {
    const fx = st.x + 2.5, fy = st.y + st.h;
    for (let i = 0; i < n; i++) R.spawn(fx + (Math.random() - 0.5) * 5, fy - 1, (Math.random() - 0.5) * 30 * k - st.vx * 0.1, -4 - Math.random() * 12 * k, 0.35 + Math.random() * 0.3, '#9aa6b4', 1, 30, false);
  }
  let caughtPrev = {}, caughtCD = 0;
  function watcherSounds() {
    if (S.dead) { caughtPrev = {}; return; }
    caughtCD = Math.max(0, caughtCD - 4);
    const px = S.x + 2.5, py = S.y + S.h * 0.5;
    for (const l of world.lights) {
      if (l.t !== 'watch') continue;
      if (Math.abs(l.x - px) > l.r + 4 || Math.abs(l.y - py) > l.r + 4) { caughtPrev[l.id] = false; continue; }
      const on = D.lightAt(world, l, px, py) > 0.12;
      if (on && !caughtPrev[l.id] && caughtCD === 0) { A.Live.sfx('caught'); caughtCD = 48; shake = Math.max(shake, 0.6); }
      caughtPrev[l.id] = on;
    }
  }
  function beamSounds() {
    let near = null, nd = 1e9;
    const px = S.x, py = S.y;
    for (const l of world.lights) {
      if (l.t !== 'beam') continue;
      const p = beamPrev[l.id] === undefined ? l.k : beamPrev[l.id];
      if (p < 0.25 && l.k >= 0.25) {
        const d = Math.hypot(l.x - px, l.y - py);
        if (d < 200 && d < nd) { nd = d; near = l; }
      }
      beamPrev[l.id] = l.k;
    }
    if (near) A.Live.sfx('beamOn', { v: 1 - nd / 220 });
  }

  /* ------------------------------------------------------------ simulation driver */
  function simStep() {
    let inp;
    if (replay) { inp = replayI < replay.length ? replay[replayI++] : 0; }
    else { inp = inputMask(); latch = 0; }
    D.step(world, S, inp);
    runTicks++;
    if (S.ev) handleEvents(S.ev, S);
    if (S.onG && !S.dead && Math.abs(S.vx) > 30 && S.st === 'run') {
      stepDist += Math.abs(S.vx) / D.TICK;
      if (stepDist > 11) { stepDist = 0; A.Live.sfx('step', { v: 1 }); if (Math.random() < 0.5) puff(S, 1, 0.4); }
    }
    if ((S.t & 7) === 0) beamSounds();
    if ((S.t & 3) === 0) watcherSounds();
    if (S.roll && (S.t & 3) === 0) puff(S, 1, 0.3);
    if (S.won) { if (mode === 'play') { mode = 'win'; winT = 0; syncTouchUI(); } }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - lastT) / 1000; lastT = now;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    frameDt = dt;
    try {
      pollPad();
      gameTime += dt;
      titleT += dt;
      if (mode === 'play' || mode === 'win') {
        simAcc += dt * speedMul;
        let n = 0;
        const stepDt = 1 / D.TICK;
        const maxN = 12 * Math.max(1, speedMul);
        while (simAcc >= stepDt && n < maxN) { simStep(); simAcc -= stepDt; n++; }
        if (n >= maxN) simAcc = 0;
        R.tickTethers(dt);
        R.updateParticles(dt);
        updateCamera(dt);
        if (mode === 'play') updateSection();
        if (mode === 'win') winT += dt;
        cardT += dt; seekerCardT += dt;
        shake = Math.max(0, shake - dt * 6); flash = Math.max(0, flash - dt * 1.6);
        const fear = Math.min(1, Math.max(S.ex * 1.15, S.lit * 0.55));
        A.Live.update(S.dead ? 0.1 : fear, mode === 'win' ? 0.7 : 1);
        if (world.boss) A.Live.boss = { p: S.bP || 0, wake: !!S.bWake, die: S.bDie || 0, burst: !!S.bBurst, warn: S.bFlareWarn };
      } else if (mode === 'pause') {
        R.updateParticles(0);
      } else if (mode === 'title' || mode === 'map') {
        A.Live.update(0.0, 1);
        R.updateParticles(dt);
        if (mode === 'map') mapFrame(dt);
      }
      render(dt);
    } catch (e) {
      err = String(e && e.stack || e);
      console.error(e);
      showError(err);
    }
  }

  /* ------------------------------------------------------------ drawing */
  function drawBar(ctx, x, y, w, h, v, col) {
    ctx.fillStyle = 'rgba(8,8,12,0.65)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * v), h);
  }
  function fmtTime(t) { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 10) % 10); return m + ':' + (s < 10 ? '0' : '') + s + '.' + c; }

  function drawTitle(ctx) {
    const t = titleT;
    ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, LW, LH);
    const cx = Math.floor(LW / 2), cy = Math.floor(LH / 2);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = t * 0.3 + i * 1.05;
      const gr = ctx.createRadialGradient(cx + Math.cos(a) * 30, cy + 40 + Math.sin(a) * 6, 0, cx + Math.cos(a) * 30, cy + 40, 90);
      const c = hexRGB(R.SHARDS[i]), al = P.beaten[i] ? 0.08 : 0.025;
      gr.addColorStop(0, 'rgba(' + c + ',' + al + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, LW, LH);
    }
    ctx.globalCompositeOperation = 'source-over';
    const sc = Math.max(1, Math.min(3, Math.floor(LH / 90)));
    const a = Math.min(1, t / 2);
    ctx.globalAlpha = a;
    R.drawText(ctx, 'DWELLER', cx, cy - 46 * (sc / 2) - 8, PAL.snow, sc * 2, 'center');
    ctx.globalAlpha = a * 0.8;
    R.drawText(ctx, 'STAY IN THE DARK  -  REACH THE LIGHT THAT ISNT FIRE', cx, cy - 8, PAL.muted, 1, 'center');
    const blink = 0.55 + 0.45 * Math.sin(t * 3);
    ctx.globalAlpha = a * blink;
    R.drawText(ctx, touchMode ? 'TAP TO DESCEND' : 'PRESS SPACE TO DESCEND', cx, cy + 14, PAL.gold, 1, 'center');
    ctx.globalAlpha = a * 0.6;
    if (!touchMode) {
      R.drawText(ctx, 'A D  MOVE     SPACE  JUMP     S  ROLL / CRAWL' + (P.comp ? '     E  SEEKER' : ''), cx, LH - 30, PAL.muted, 1, 'center');
      R.drawText(ctx, 'ESC  PAUSE     M  MUTE     F  FULLSCREEN', cx, LH - 20, PAL.muted, 1, 'center');
    }
    R.drawText(ctx, count() + ' OF 6 SLIVERS', cx, LH - 44 + (touchMode ? 20 : 0), PAL.stone4, 1, 'center');
    ctx.globalAlpha = a;
    R.drawGem(ctx, cx + 64, cy + 64, 0.55, P.beaten, t, count() >= NL);
    ctx.globalAlpha = 1;
    drawTitleSeeker(ctx, cx, cy + 74, t);
    if (P.comp) R.drawMini(ctx, cx - 14, cy + 58, t, 'on', 1);
  }
  function drawTitleSeeker(ctx, x, y, t) {
    const sh = R.SHEETS.breath, shv = R.SHEETS.breathV;
    if (!sh) return;
    const f = R.BREATH[Math.floor(t * 12) % R.BREATH.length];      // the breathing pose
    const sx = (f % sh.cols) * sh.w, sy = Math.floor(f / sh.cols) * sh.h;
    ctx.globalAlpha = 0.18;
    ctx.drawImage(sh.cv, sx, sy, sh.w, sh.h, x - sh.ax, y - sh.ay, sh.w, sh.h);
    ctx.globalAlpha = 1;
    ctx.drawImage(shv.cv, sx, sy, sh.w, sh.h, x - sh.ax, y - sh.ay, sh.w, sh.h);
  }

  function render(dt) {
    fitView();
    const ctx = octx;
    ctx.imageSmoothingEnabled = false;
    let ox = 0, oy = 0;
    if (mode === 'loading') {
      ctx.fillStyle = '#07070c'; ctx.fillRect(0, 0, LW, LH);
      R.drawText(ctx, 'DWELLER', LW >> 1, (LH >> 1) - 8, PAL.muted, 2, 'center');
    } else if (mode === 'title') {
      drawTitle(ctx);
    } else if (mode === 'map') {
      drawMap(ctx, dt);
    } else {
      const sx = shake > 0 ? (Math.random() - 0.5) * shake * 1.2 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 1.2 : 0;
      const cxp = camX + sx, cyp = camY + sy;
      const fx = Math.floor(cxp), fy = Math.floor(cyp);
      ox = (cxp - fx) * SC; oy = (cyp - fy) * SC;
      R.drawScene(ctx, { w: world, s: S, time: gameTime, dt: mode === 'pause' ? 0 : dt }, fx, fy, LW, LH);
      drawHUD(ctx);
    }
    gctx.imageSmoothingEnabled = false;
    gctx.fillStyle = '#000'; gctx.fillRect(0, 0, canvas.width, canvas.height);
    gctx.drawImage(off, 0, 0, LW, LH, Math.round(-ox), Math.round(-oy), LW * SC, LH * SC);
    drawCard();
  }
  /* the section's name: three quarters of its old size (drawn at screen resolution so the letters stay crisp),
     no band behind it, only a faint one-pixel shadow so it reads over light */
  function drawCard() {
    if (!(cardT < 4.5 && mode === 'play' && seekerCardT > 6.5)) return;
    const a = Math.min(1, cardT / 0.8) * Math.min(1, (4.5 - cardT) / 1.0);
    const k = Math.max(2, Math.round(SC * 1.5)), sp = R.textSprite(cardText, PAL.snow), sh = R.textSprite(cardText, '#05050a');
    const w = sp.width * k, h = sp.height * k, x = Math.round((canvas.width - w) / 2), y = Math.round(LH * 0.22 * SC);
    gctx.imageSmoothingEnabled = false;
    gctx.globalAlpha = a * 0.6; gctx.drawImage(sh, x + Math.max(1, k >> 2), y + Math.max(1, k >> 2), w, h);
    gctx.globalAlpha = a * 0.92; gctx.drawImage(sp, x, y, w, h);
    gctx.globalAlpha = 1;
  }

  function drawHUD(ctx) {
    const S_ = S;
    if (S_.ex > 0.02 && !S_.dead) {
      const e = Math.min(1, S_.ex);
      const gr = ctx.createRadialGradient(LW / 2, LH / 2, LH * 0.35, LW / 2, LH / 2, LH * 0.95);
      gr.addColorStop(0, 'rgba(230,240,255,0)'); gr.addColorStop(1, 'rgba(230,240,255,' + (0.5 * e * e).toFixed(3) + ')');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, LW, LH);
    }
    if (flash > 0) { ctx.globalAlpha = Math.min(1, flash) * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1; }
    if (S_.dead) {
      const k = Math.min(1, S_.deadT / 60) * (S_.deadT > D.C.DEADT - 30 ? Math.max(0, (D.C.DEADT - S_.deadT) / 30) : 1);
      ctx.globalAlpha = k * 0.85; ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1;
      if (S_.deadT > 20) { ctx.globalAlpha = Math.min(1, (S_.deadT - 20) / 20) * k; R.drawText(ctx, S_.why === 'void' ? 'THE DARK TOOK YOU' : 'THE LIGHT FOUND YOU', LW >> 1, (LH >> 1) - 4, PAL.muted, 1, 'center'); ctx.globalAlpha = 1; }
    }
    if (S_.ex > 0.04 && !S_.dead) {
      const px = Math.round(S_.x + 2.5 - camX), py = Math.round(S_.y - 7 - camY);
      drawBar(ctx, px - 8, py, 16, 2, Math.min(1, S_.ex), S_.ex > 0.7 ? '#e8e0d0' : '#a9c4d2');
    }
    if (world.boss && (mode === 'play' || mode === 'pause')) {
      // the six slivers: set ones burn in their colour, the next one pulses
      const n = S_.bP || 0, x0 = (LW >> 1) - 5 * 9;
      for (let i = 0; i < 6; i++) {
        const x = x0 + i * 18, y = 10, col = R.SHARDS[i];
        ctx.globalAlpha = i < n ? 1 : i === n && S_.bWake ? 0.45 + 0.35 * Math.sin(gameTime * 6) : 0.22;
        ctx.fillStyle = col; ctx.fillRect(x, y, 3, 7); ctx.fillRect(x + 1, y - 1, 1, 9);
      }
      ctx.globalAlpha = 1;
      // the flare is coming: the edges of the screen warm a beat before it burns
      if (S_.bFlareWarn >= 0 && S_.bFlareWarn < 64) {
        const k = S_.bFlareWarn / 64, g = ctx.createRadialGradient(LW / 2, LH / 2, LH * 0.25, LW / 2, LH / 2, LH * 0.9);
        g.addColorStop(0, 'rgba(255,220,180,0)'); g.addColorStop(1, 'rgba(255,200,150,' + (0.08 + 0.22 * k * (0.6 + 0.4 * Math.sin(gameTime * 30))).toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
      }
    }
    // the section's name is drawn on the full-resolution screen after the upscale (see drawCard)
    // the companion's charge (top left)
    if (S_.cmp && mode !== 'win') {
      const x = 12, y = Math.round(44 / SC) + 3;
      const ready = S_.cmp === 1 && S_.cmpCD === 0;
      ctx.globalAlpha = ready ? 0.9 : 0.55;
      R.drawMini(ctx, x, y + 2, gameTime, ready ? 'on' : 'cool', 1, 1 - S_.cmpCD / D.C.CMPCD);
      R.drawText(ctx, touchMode ? 'SEEK' : 'E', x + 9, y - 1, ready ? '#9fd3c7' : '#4b5f63', 1, 'left');
      ctx.globalAlpha = 1;
    }
    if (seekerCardT < 6.5) {
      const a = Math.min(1, seekerCardT / 0.6) * Math.min(1, (6.5 - seekerCardT) / 1.0);
      const cy = Math.round(LH * 0.32);
      ctx.globalAlpha = a * 0.75; ctx.fillStyle = '#05070b'; ctx.fillRect(0, cy - 34, LW, 78); ctx.globalAlpha = a;
      R.drawPortrait(ctx, LW / 2 - 60, cy + 4, 1, a);
      ctx.globalAlpha = a;
      R.drawText(ctx, 'A SEEKER WAKES', LW / 2 - 20, cy - 16, PAL.snow, 2, 'left');
      R.drawText(ctx, 'SEEKER NET  #' + R.seekerId + '  FOLLOWS YOU NOW', LW / 2 - 20, cy + 6, '#9fd3c7', 1, 'left');
      R.drawText(ctx, touchMode ? 'TAP SEEK  -  IT COVERS THE NEAREST LIGHT' : 'PRESS E  -  IT COVERS THE NEAREST LIGHT', LW / 2 - 20, cy + 18, PAL.gold, 1, 'left');
      R.drawText(ctx, 'FOR A FEW BEATS', LW / 2 - 20, cy + 28, '#8a919e', 1, 'left');
      ctx.globalAlpha = 1;
    }
    if (mode === 'play') {
      ctx.globalAlpha = 0.5;
      if (touchMode) R.drawText(ctx, fmtTime(runTicks / D.TICK), LW >> 1, Math.round(44 / SC), PAL.muted, 1, 'center');
      else R.drawText(ctx, fmtTime(runTicks / D.TICK), LW - 6, Math.round(44 / SC), PAL.muted, 1, 'right');
      ctx.globalAlpha = 1;
    }
    if (mode === 'pause') {
      ctx.fillStyle = 'rgba(5,5,10,0.7)'; ctx.fillRect(0, 0, LW, LH);
      R.drawText(ctx, touchMode ? 'TAP HERE  -  MAP' : 'Q  MAP', LW >> 1, Math.round(LH * 0.16), '#8a919e', 1, 'center');
      R.drawText(ctx, ROMAN[cur] + '  ' + NAMES[cur], LW >> 1, (LH >> 1) - 36, '#8a919e', 1, 'center');
      R.drawText(ctx, 'PAUSED', LW >> 1, (LH >> 1) - 22, PAL.snow, 2, 'center');
      R.drawText(ctx, touchMode ? 'TAP TO RESUME' : 'ESC  RESUME', LW >> 1, (LH >> 1) + 2, PAL.gold, 1, 'center');
      R.drawText(ctx, touchMode ? 'TAP LOWER SCREEN  NEW DESCENT' : 'N  NEW DESCENT', LW >> 1, (LH >> 1) + 44, PAL.snow, 1, 'center');
      R.drawText(ctx, 'TIME  ' + fmtTime(runTicks / D.TICK) + '    DEATHS  ' + S_.deaths, LW >> 1, (LH >> 1) + 16, PAL.muted, 1, 'center');
      R.drawText(ctx, 'M  MUTE   F  FULLSCREEN   R  RETURN TO TETHER', LW >> 1, (LH >> 1) + 30, PAL.stone4, 1, 'center');
    }
    if (mode === 'win') {
      const a = Math.min(1, Math.max(0, (winT - 1.2) / 1.5));
      ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = a;
      const y0 = Math.round(LH * 0.18);
      if (cur === CORE) {
        R.drawText(ctx, 'THE CORE IS QUIET', LW >> 1, y0, PAL.snow, 2, 'center');
        R.drawText(ctx, 'THE GUARDIAN IS GONE, AND THE DARK BELOW IS YOURS', LW >> 1, y0 + 22, PAL.gold, 1, 'center');
        R.drawText(ctx, 'TIME  ' + fmtTime(winTime) + (newBest ? '  NEW BEST' : '') + '     LIGHT FOUND YOU  ' + S_.deaths + ' TIMES', LW >> 1, y0 + 36, PAL.snow, 1, 'center');
        R.drawGem(ctx, LW >> 1, y0 + 70, 0.9, P.beaten, gameTime, true);
        const cr = ['DWELLER', 'A GAME IN THE SEEKER UNIVERSE  -  OPEN ART, MUSIC AND LORE', 'THE GUARDIAN  -  PLANETARY GUARDIAN #255', 'YOUR COMPANION  -  SEEKER NET #' + R.seekerId, 'THANK YOU FOR DESCENDING'];
        cr.forEach((c, i) => R.drawText(ctx, c, LW >> 1, y0 + 96 + i * 12, i ? '#a9b2c0' : PAL.gold, 1, 'center'));
        if (winT > 2.5) { ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(winT * 3)); R.drawText(ctx, touchMode ? 'TAP FOR THE MAP' : 'ENTER  MAP     N  AGAIN', LW >> 1, y0 + 162, PAL.gold, 1, 'center'); }
        ctx.globalAlpha = 1;
        return;
      }
      R.drawText(ctx, 'A SLIVER OF THE CRYSTAL', LW >> 1, y0, R.SHARDS[cur], 2, 'center');
      R.drawText(ctx, ROMAN[cur] + '  ' + NAMES[cur] + '  COMPLETE', LW >> 1, y0 + 22, PAL.gold, 1, 'center');
      const t = winTime;
      R.drawText(ctx, 'TIME  ' + fmtTime(t) + (newBest ? '  NEW BEST' : '') + '     LIGHT FOUND YOU  ' + S_.deaths + ' TIMES', LW >> 1, y0 + 36, PAL.snow, 1, 'center');
      R.drawGem(ctx, LW >> 1, y0 + 70, 0.9, P.beaten, gameTime, count() >= NL);
      R.drawText(ctx, count() + ' OF 6 SLIVERS', LW >> 1, y0 + 92, '#a9b2c0', 1, 'center');
      if (winT > 2.5) { ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(winT * 3)); R.drawText(ctx, touchMode ? 'TAP FOR THE MAP' : 'ENTER  MAP     N  AGAIN', LW >> 1, y0 + 108, PAL.gold, 1, 'center'); }
      ctx.globalAlpha = 1;
    }
  }

  function showError(msg) {
    const el = document.getElementById('err');
    if (el) { el.style.display = 'block'; el.textContent = 'Dweller hit a snag:\n' + msg.slice(0, 600) + '\n\nTry reloading the page.'; }
  }

  /* ------------------------------------------------------------ boot */
  async function boot() {
    resize();
    canvas.tabIndex = 0; canvas.style.outline = 'none'; grabFocus();
    buildTouchUI();
    loadProgress();
    const q = new URLSearchParams(location.search);
    try {
      await R.load(window.DWELLER_ASSETS);
      pickSeeker();
      loadLevel(0);
      S = D.newState(world); snapCamera();
    } catch (e) { showError(String(e && e.stack || e)); console.error(e); return; }
    const ld = document.getElementById('loading'); if (ld) ld.remove();
    mode = 'title'; titleT = 0;
    // the map opens on the deepest level you can play
    sel = 0; for (let i = 0; i < NL; i++) if (built(i) && unlocked(i)) sel = i;
    if (q.get('speed')) speedMul = Math.max(1, Math.min(32, parseFloat(q.get('speed')) || 1));
    lastT = performance.now();
    requestAnimationFrame(frame);
    // debug / test hooks
    window.__dweller = {
      get state() { return S; }, get world() { return world; }, get mode() { return mode; }, get level() { return cur; }, get progress() { return P; },
      start(fresh) { startLevel(cur < 0 ? 0 : cur, !!fresh); },
      startLevel(i, fresh) { startLevel(i, fresh === undefined ? true : !!fresh); },
      map() { toMap(); },
      setProgress(o) { Object.assign(P, o); saveProgress(); },
      replay(inputs, speed) { replay = inputs; replayI = 0; speedMul = speed || 1; },
      setSpeed(v) { speedMul = v; },
      teleport(x, y) { S.x = x; S.y = y; snapCamera(); },
      shot() { return canvas.toDataURL('image/png'); },
      get ticks() { return runTicks; },
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
