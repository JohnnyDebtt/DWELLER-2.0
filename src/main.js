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
  let mapT = 0, flare = null, fuseT = -1;
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
        P.comp = !!j.comp; P.cp = j.cp && typeof j.cp === 'object' ? j.cp : {}; P.fused = !!j.fused; P.seekerId = j.seekerId; P.core = !!j.core; P.coreBest = +j.coreBest || 0; P.seen = j.seen && typeof j.seen === 'object' ? j.seen : {}; P.snv = j.snv;
        return;
      }
    } catch (e) { }
    // carry over a save from the single-level release
    const b = parseFloat(lsGet('dweller.best') || '');
    if (b > 0) { P.beaten[0] = true; P.best[0] = b; }
    try { const v = JSON.parse(lsGet('dweller.v1') || 'null'); if (v && v.cp > 0) P.cp[0] = v; } catch (e) { }
  }
  function saveProgress() { lsSet('dweller.v2', JSON.stringify(P)); }
  /* any one of the 2,222 SEEKER NET seekers sleeps in the mycelium; which one is rolled once per save
     (saves from before every seeker could wake are rolled again) */
  function pickSeeker() {
    if (P.snv !== 2 || !(P.seekerId >= 1 && P.seekerId <= R.NETN)) { P.seekerId = 1 + Math.floor(Math.random() * R.NETN); P.snv = 2; saveProgress(); }
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
    if (k) { if (!e.repeat && LATCH[k] && (mode === 'play' || mode === 'town')) latch |= LATCH[k]; keys[k] = true; e.preventDefault(); }
    if (e.code === 'Backspace' || e.code === 'Tab') e.preventDefault();
    if (e.repeat) return;
    audioInit();
    if (mode === 'title') {
      if (['Space', 'Enter', 'ArrowUp', 'KeyW', 'ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'KeyZ', 'KeyK', 'ArrowDown', 'KeyS', 'KeyE'].includes(e.code)) beginTown();
    } else if (mode === 'town') {
      if (e.code === 'Enter') townInteract(false);
      if (e.code === 'KeyN') townInteract(true);
      if (e.code === 'Escape') toTitle();
    } else if (mode === 'win') {
      if (e.code === 'KeyN') { startLevel(cur, true); return; }
      if (e.code === 'Escape' || e.code === 'KeyQ') { toTown(cur); return; }
      if (winT > 2.5 && (e.code === 'Enter' || e.code === 'Space')) toTown(cur);
    } else if (mode === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') setPause(true);
      if (e.code === 'KeyR' && !S.dead && !S.won) { S.ex = 1; S.grace = 0; }   // give up: let the light take you back to the tether
    } else if (mode === 'pause') {
      if (e.code === 'KeyN') { A.Live.setPaused(false); startLevel(cur, true); return; }
      if (e.code === 'KeyQ' || e.code === 'Backspace') { A.Live.setPaused(false); toTown(cur); return; }
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
    const pb = document.createElement('div'); pb.className = 'tb small'; pb.id = 'tbP'; pb.textContent = 'II'; root.appendChild(pb); tbtn.P = pb;
    pb.addEventListener('pointerdown', (e) => { e.preventDefault(); audioInit(); if (mode === 'play') setPause(true); else if (mode === 'pause') setPause(false); });
    addEventListener('touchstart', () => { if (!touchMode) { touchMode = true; } document.body.classList.add('touch'); }, { passive: true });
  }
  function syncTouchUI() {
    const playing = mode === 'play' || mode === 'pause' || mode === 'town';
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('cmp', mode === 'town' || (playing && !!(S && S.cmp)));
    if (tbtn.E) tbtn.E.textContent = mode === 'town' ? 'ENTER' : 'SEEK';
    if (tbtn.P) tbtn.P.style.display = mode === 'town' ? 'none' : '';
  }
  canvas.addEventListener('pointerdown', (e) => {
    audioInit(); grabFocus();
    if (e.pointerType === 'touch') { touchMode = true; document.body.classList.add('touch'); }
    const r = canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (mode === 'title') beginTown();
    else if (mode === 'pause') {
      if (e.pointerType !== 'touch') { setPause(false); return; }
      if (fy < 0.3) { A.Live.setPaused(false); toTown(cur); }
      else if (fy > 0.68) { A.Live.setPaused(false); startLevel(cur, true); }
      else setPause(false);
    }
    else if (mode === 'win' && winT > 2.5) toTown(cur);
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
      if (edge('start', b(9))) { if (mode === 'play') setPause(true); else if (mode === 'pause') setPause(false); else if (mode === 'title') beginTown(); else if (mode === 'town') toTitle(); else if (mode === 'win' && winT > 2.5) toTown(cur); }
      if (mode === 'title' && edge('a', b(0))) beginTown();
      else edge('a', b(0));
      if (mode === 'win' && winT > 2.5 && edge('a2', b(0))) toTown(cur);
    }
  }

  /* ------------------------------------------------------------ layout */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(2, Math.round(innerWidth * DPR)), ch = Math.max(2, Math.round(innerHeight * DPR));
    canvas.width = cw; canvas.height = ch;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    SC = Math.max(1, Math.round(ch / (cur === CORE && mode !== 'town' && mode !== 'title' ? 360 : (window.__viewH || 230))));   // the Guardian's arena is seen from further back
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
  function fitView() { const k = cur === CORE && mode !== 'town' && mode !== 'title' ? 1 : 0; if (k !== scFor) { scFor = k; resize(); } }
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

  /* ------------------------------------------------------------ the town above the descent
   * The Dweller walks the town with the real simulation (on the town's own little world). Each level is a door;
   * the great door under the mountain takes the whole crystal and leads to the Core. */
  const T = window.DwellerTown;
  let tW = null, tS = null, tcamX = 0, tcamY = 0, tAcc = 0, tPrevE = false, still = 0;
  let near = null, nearKey = '', townMsg = '', townMsgT = 99, titleOut = 99, bootFade = 0, rareCardT = 99;
  const talk = {};
  const LINES = {
    collector: () => [
      'THE WELL IS DEEPER THAN IT LOOKS', 'I KEEP WHAT THE LIGHT LEAVES BEHIND', 'DONT STAND UNDER THE LAMPS TOO LONG',
      'SOME SEEKERS SLEEP WHERE NOBODY LOOKS', 'THE ROPE IN THE WELL GOES ALL THE WAY DOWN',
    ].concat(P.wellUsed ? ['YOU WOKE THE ONE DOWN THERE. GOOD'] : []),
    exiled: () => [
      'THEY SENT ME UP. I DONT GO DOWN ANYMORE', 'EVERY DOOR IN THIS TOWN GOES FURTHER DOWN', 'THE MOUNTAIN WAS HERE BEFORE THE TOWN. SO WAS THE DOOR',
      'IF THE TREES BLINK, STAND STILL', 'NOBODY LIGHTS THE LAMPS. NOBODY WANTS TO BE SEEN',
    ].concat(P.beaten[1] && !P.comp ? ['THE MYCELIUM HAS A FALSE WALL. SOMETHING SLEEPS BEHIND IT', 'THE MYCELIUM HAS A FALSE WALL. SOMETHING SLEEPS BEHIND IT'] : []).concat(count() >= 3 ? ['YOUR DOORS ARE BURNING NICELY'] : [])
     .concat(count() >= NL && !P.core ? ['THE GREAT DOOR IS HUMMING. GO ON'] : []),
    // the silent one speaks only once the Guardian is gone, and always in this order
    monk: () => P.core ? ['YOU BROKE THE GUARDIAN', 'IT WAS NOT KEEPING YOU OUT', 'IT WAS KEEPING SOMETHING IN', 'GO BACK DOWN IF YOU LIKE. IT IS LISTENING NOW'] : ['...'],
  };
  function groundY(x) { return T.groundAt(Math.floor(x / D.TS)) * D.TS; }
  function townSpawn(x) {
    tS = D.newState(tW, { companion: P.comp });
    if (x !== undefined) { tS.x = x - D.C.W / 2; tS.y = groundY(x) - D.C.H; tS.cmpX = x - 9; tS.cmpY = groundY(x) - 22; }
    tS.grace = 0; tAcc = 0; still = 0; near = null; nearKey = '';
    snapTown();
  }
  function doorX(i) { return i >= NL ? T.GREAT.x : T.doorShape(T.DOORS[i]).x; }
  function toTown(focus) {
    if (!tW) tW = T.build();
    mode = 'town'; townMsgT = 99; R.parts.length = 0;
    townSpawn(focus === undefined ? undefined : doorX(focus) + (focus >= NL ? 0 : 0));
    A.Live.setTheme(-1); A.Live.setMood(0.12, 0);
    syncTouchUI();
  }
  function toMap(focus) { toTown(focus); }
  function toTitle() { mode = 'title'; titleT = 3; titleOut = 99; syncTouchUI(); }
  function beginTown() { if (mode !== 'title') return; for (const k in keys) keys[k] = false; latch = 0; mode = 'town'; titleOut = 0; syncTouchUI(); A.Live.sfx('ui'); }

  function townCamTarget() {
    const px = tS.x + 2.5, py = tS.y + tS.h;
    const camY0 = T.GY - LH * 0.8;
    let tx = px - LW / 2 + Math.max(-1, Math.min(1, tS.vx / 72)) * 20;
    let ty = py > T.GY + 14 ? py - LH * 0.55 : camY0;
    tx = Math.max(0, Math.min(T.WPX - LW, tx));
    ty = Math.max(camY0, Math.min(T.HPX - LH, ty));
    return [tx, ty, camY0];
  }
  function snapTown() { const t = townCamTarget(); tcamX = t[0]; tcamY = t[1]; }

  function townNear() {
    const px = tS.x + 2.5, feet = tS.y + tS.h;
    if (feet > T.GY + 20) return Math.abs(px - T.RAREX) < 14 && feet > T.RAREY - 8 ? { k: 'rare', x: T.RAREX, y: T.RAREY - 34 } : null;
    for (const d of T.DOORS) {
      const sh = T.doorShape(d);
      if (Math.abs(px - sh.x) < sh.w / 2 + 3 && Math.abs(feet - T.GY) < 3) return { k: 'door', i: d.i, x: sh.x, y: sh.y - sh.h - 14 };
    }
    if (Math.abs(px - T.GREAT.x) < 24 && Math.abs(feet - T.GREAT.y) < 3) return { k: 'great', x: T.GREAT.x, y: T.GREAT.y - 70 };
    for (const q of T.RES) if (Math.abs(px - q.x) < 18 && Math.abs(feet - T.GY) < 8) return { k: 'res', q, x: q.x, y: T.GY - 30 };
    return null;
  }
  function say(msg, sfx) { townMsg = msg; townMsgT = 0; if (sfx) A.Live.sfx(sfx); }
  function townInteract(fresh) {
    if (mode !== 'town' || fuseT >= 0 || !near) return;
    if (near.k === 'door') {
      const i = near.i;
      if (!built(i)) return say('THIS DEPTH IS NOT YET DUG', 'nope');
      if (!unlocked(i)) return say('SEALED  -  BEAT ' + ROMAN[i - 1] + ' TO OPEN IT', 'nope');
      startLevel(i, fresh);
    } else if (near.k === 'great') {
      if (count() < NL) return say('IT WANTS THE WHOLE CRYSTAL  -  ' + count() + ' OF 6', 'nope');
      if (!P.fused) { fuseT = 0; A.Live.sfx('check'); return; }
      if (built(CORE)) startLevel(CORE, fresh);
    } else if (near.k === 'res') {
      const L = LINES[near.q.id](); talk[near.q.id] = ((talk[near.q.id] || 0) + 1) % L.length; A.Live.sfx('ui');
    } else if (near.k === 'rare') wakeRare();
  }
  /* the sleeper under the well: a rare seeker (one of the 222 rarest in SEEKER NET). Once per save, it takes your
     seeker's place, and yours sleeps down there instead */
  function rareChoice() {
    const rare = R.NET && R.NET.rare || [];
    if (!(P.rareId >= 1) && rare.length) { let q; do { q = rare[Math.floor(Math.random() * rare.length)][0]; } while (q === P.seekerId && rare.length > 1); P.rareId = q; saveProgress(); }
    return P.rareId;
  }
  function rareRank(id) { const r = (R.NET && R.NET.rare || []).find(q => q[0] === id); return r ? r[1] + 1 : 0; }
  function wakeRare() {
    if (P.wellUsed) return say('YOUR OLD SEEKER SLEEPS HERE NOW. LET IT REST');
    if (!P.comp) return say('IT SLEEPS. IT WAITS FOR A SEEKER OF YOUR OWN', 'nope');
    const id = rareChoice();
    P.wellOld = P.seekerId; P.seekerId = id; P.wellUsed = true; saveProgress();
    R.setSeeker(id);
    A.Live.sfx('seeker'); flash = 0.6; rareCardT = 0;
    for (let i = 0; i < 60; i++) { const a = Math.random() * 6.283, sp = 10 + Math.random() * 45; R.spawn(T.RAREX, T.RAREY - 16, Math.cos(a) * sp, Math.sin(a) * sp - 10, 0.8 + Math.random(), i % 2 ? '#5daa99' : '#d5f8fc', 1, 10, true); }
  }

  function townStep(inp) {
    D.step(tW, tS, inp & ~IN.E);
    if (tS.ev) handleEvents(tS.ev & (EV.JUMP | EV.WJUMP | EV.LAND | EV.HARDLAND | EV.ROLL | EV.GRAB), tS);
    if (tS.onG && Math.abs(tS.vx) > 30 && tS.st === 'run') {
      stepDist += Math.abs(tS.vx) / D.TICK;
      if (stepDist > 11) { stepDist = 0; A.Live.sfx('step', { v: 0.8 }); if (Math.random() < 0.5) puff(tS, 1, 0.4); }
    }
  }
  function townFrame(dt) {
    if (!tW) { tW = T.build(); townSpawn(); }
    mapT += dt; townMsgT += dt; rareCardT += dt; titleOut += dt; bootFade += dt;
    const stepDt = 1 / D.TICK;
    tAcc += dt; let n = 0;
    while (tAcc >= stepDt && n < 12) {
      let inp = mode === 'town' && fuseT < 0 && rareCardT > 5.5 ? inputMask() : 0;
      latch = 0;
      const e = !!(inp & IN.E), was = mode;
      if (e && !tPrevE) townInteract(false);
      tPrevE = e;
      if (mode !== was) return;             // a door was taken
      townStep(inp);
      still = inp === 0 && tS.onG && Math.abs(tS.vx) < 1 ? still + stepDt : 0;
      tAcc -= stepDt; n++;
    }
    if (n >= 12) tAcc = 0;
    R.updateParticles(dt);
    const t = townCamTarget(), kx = 1 - Math.exp(-dt * 5.5), ky = 1 - Math.exp(-dt * 4.5);
    if (window.__townCam !== undefined) { t[0] = Math.max(0, Math.min(T.WPX - LW, window.__townCam - LW / 2)); }   // (for pictures of the town)
    tcamX += (t[0] - tcamX) * kx; tcamY += (t[1] - tcamY) * ky;
    const nn = townNear(), key = nn ? nn.k + (nn.i !== undefined ? nn.i : nn.q ? nn.q.id : '') : '';
    if (key !== nearKey) {
      nearKey = key; townMsgT = 99;
      if (nn && nn.k === 'res') { const L = LINES[nn.q.id](); talk[nn.q.id] = nn.q.id === 'monk' ? (talk.monk === undefined ? 0 : (talk.monk + 1) % L.length) : Math.floor(Math.random() * L.length); }
    }
    near = nn;
    // a sliver found for the first time lights its door
    if (flare) {
      flare.t += dt;
      if (flare.pending && flare.t > 0) {
        flare.pending = false; A.Live.sfx('check');
        const x = doorX(flare.i), y = T.GY - 12;
        for (let k = 0; k < 50; k++) { const a = Math.random() * 6.283, sp = 8 + Math.random() * 34; R.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 14, 0.8 + Math.random(), k % 2 ? R.SHARDS[flare.i] : '#ffffff', 1, 20, true); }
      }
      if (flare.t > 2.2) flare = null;
    }
    // the crystal goes into the great door
    if (fuseT >= 0) {
      fuseT += dt;
      if (fuseT > 2.2 && fuseT - dt <= 2.2) { A.Live.sfx('win'); flash = 1.2; shake = 2; }
      if (fuseT > 4.2) { P.fused = true; saveProgress(); fuseT = -1; }
    }
  }

  /* the town's words are drawn at half size, after the upscale, at the screen's own resolution so they stay crisp.
     ht() queues one (x, y in town pixels, y at the top of the letters); HS is how many town pixels a letter pixel takes */
  const HT = [];
  let HK = 1, HS = 0.5;
  function ht(t, x, y, col, align, alpha, sc) { HT.push([t, x, y, col, align || 'left', alpha === undefined ? ctxAlpha : alpha, sc || 1]); }
  let ctxAlpha = 1;
  function htW(t, sc) { return R.textWidth(t) * HS * (sc || 1); }
  function flushHT() {
    for (const [t, x, y, col, al, a, sc] of HT) {
      if (a <= 0) continue;
      const sp = R.textSprite(t, col), k = HK * sc, w = sp.width * k;
      let X = x * SC; if (al === 'center') X -= w / 2; else if (al === 'right') X -= w;
      gctx.globalAlpha = Math.min(1, a); gctx.drawImage(sp, Math.round(X), Math.round(y * SC), w, sp.height * k);
    }
    gctx.globalAlpha = 1; HT.length = 0;
  }
  function wrap(text, max) {
    const out = []; let ln = '';
    for (const w of text.split(' ')) { const t = ln ? ln + ' ' + w : w; if (R.textWidth(t) > max && ln) { out.push(ln); ln = w; } else ln = t; }
    if (ln) out.push(ln); return out;
  }
  function drawTown(ctx, dt) {
    const camY0 = T.GY - LH * 0.8;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    HK = Math.max(1, Math.round(SC / 2)); HS = HK / SC; HT.length = 0; ctxAlpha = 1;
    const LH7 = Math.ceil(7 * HS) + 3;          // one line of half-size text, with its gap
    T.draw(ctx, {
      text: (t, x, y, c, al) => ht(t, x, y, c, al, 1), s: tS, camX: tcamX + sx, camY: tcamY, camY0, LW, LH, time: gameTime, dt, P, still, fuse: fuseT, flare,
      inRoom: tS.y + tS.h > (T.WELL.room[2] + 1) * D.TS,
      unlocked: (i) => built(i) && unlocked(i), rareId: rareChoice(), rareUsed: !!P.wellUsed, oldId: P.wellOld,
    });
    const cx = Math.round(tcamX + sx), cy = Math.round(tcamY);
    T.signText(ctx, cx, cy, touchMode, P.comp, (t, x, y, c, al) => ht(t, x, y, c, al, 1), HS);
    // the six slivers flying into the great door
    if (fuseT >= 0 && fuseT < 2.3) {
      const px = tS.x + 2.5, py = tS.y - 4;
      for (let i = 0; i < NL; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 3;
        const ox = px + Math.cos(gameTime * 2 + i * 1.047) * 12, oy = py - 10 + Math.sin(gameTime * 2 + i * 1.047) * 6;
        const tx = T.GREAT.x + Math.cos(a) * 10, ty = T.GREAT.y - 42 + Math.sin(a) * 6;
        const rise = Math.min(1, fuseT / 0.8), u = Math.max(0, Math.min(1, (fuseT - 0.8) / 1.4)), e = u * u * (3 - 2 * u);
        const x0 = px + (ox - px) * rise, y0 = py + (oy - py) * rise;
        R.drawShard(ctx, x0 + (tx - x0) * e - cx, y0 + (ty - y0) * e - cy - Math.sin(e * Math.PI) * 18, R.SHARDS[i], gameTime, 0, 0.45);
      }
    }
    // what is near: a door's name and what it holds, the great door, a resident's words, the sleeper
    const lines = [];
    if (near && fuseT < 0 && mode === 'town') {
      const key = touchMode ? 'ENTER' : 'E';
      if (near.k === 'door') {
        const i = near.i, sv = P.cp[i];
        lines.push([ROMAN[i] + '  ' + NAMES[i], P.beaten[i] ? R.SHARDS[i] : unlocked(i) && built(i) ? PAL.snow : '#8a919e']);
        if (!built(i)) lines.push(['NOT YET DUG', '#6b7280']);
        else if (!unlocked(i)) lines.push(['SEALED  -  BEAT ' + ROMAN[i - 1] + ' FIRST', '#6b7280']);
        else {
          lines.push([P.beaten[i] ? 'SLIVER FOUND' + (P.best[i] ? '   BEST ' + fmtTime(P.best[i]) : '') : 'THE SLIVER STILL GLOWS BELOW', '#a9b2c0']);
          lines.push([key + '  ' + (sv && sv.cp > 0 ? 'CONTINUE FROM TETHER ' + sv.cp : 'DESCEND'), PAL.gold, true]);
          if (sv && sv.cp > 0 && !touchMode) lines.push(['N  FROM THE TOP', '#8a919e']);
        }
      } else if (near.k === 'great') {
        const all = count() >= NL, sv = P.cp[CORE];
        lines.push([P.fused ? 'VII  THE CORE' : 'THE GREAT DOOR', all ? PAL.snow : '#a9b2c0']);
        if (!all) lines.push([count() + ' OF 6 SLIVERS  -  IT WANTS THE WHOLE CRYSTAL', '#8a919e']);
        else if (!P.fused) lines.push([key + '  SET THE CRYSTAL', PAL.gold, true]);
        else {
          lines.push([P.core ? 'THE GUARDIAN IS GONE' + (P.coreBest ? '   BEST ' + fmtTime(P.coreBest) : '') : 'A GUARDIAN WAITS BELOW', '#d6dbe4']);
          lines.push([key + '  ' + (sv && sv.cp > 0 ? 'CONTINUE FROM THE THIRD SLIVER' : 'DESCEND'), PAL.gold, true]);
          if (sv && sv.cp > 0 && !touchMode) lines.push(['N  FROM THE TOP', '#8a919e']);
        }
      } else if (near.k === 'res') {
        const L = LINES[near.q.id](), t = L[(talk[near.q.id] || 0) % L.length];
        for (const w of wrap(t, Math.min(200, LW - 24) / HS)) lines.push([w, near.q.id === 'monk' && !P.core ? '#6b7280' : '#c3cbd6']);
        if (L.length > 1) lines.push([key + '  MORE', '#5d6474']);
      } else if (near.k === 'rare') {
        if (P.wellUsed) lines.push(['SEEKER NET #' + P.wellOld + ' SLEEPS HERE', '#7f9aa6']);
        else {
          lines.push(['A RARE SEEKER SLEEPS HERE', '#9fd3c7']);
          lines.push(['SEEKER NET #' + rareChoice() + '  -  RARITY ' + rareRank(rareChoice()) + ' OF ' + R.NETN, '#7f9aa6']);
          if (P.comp) { lines.push([key + '  WAKE IT  -  YOURS WILL SLEEP IN ITS PLACE', PAL.gold, true]); lines.push(['IT WAKES ONLY ONCE', '#5d6474']); }
          else lines.push(['IT WAITS FOR A SEEKER OF YOUR OWN', '#6b7280']);
        }
      }
    }
    if (townMsgT < 3) lines.push([townMsg, '#d6b98a']);
    if (window.__clean) lines.length = 0;                // (for pictures of the town)
    if (lines.length && near) {
      let y = Math.round(near.y + 8 - cy - lines.length * LH7);
      y = Math.max(4, y);
      for (const [t, c, blink] of lines) {
        const w = htW(t), x = Math.max(w / 2 + 3, Math.min(LW - w / 2 - 3, near.x - cx));
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#05060a'; ctx.fillRect(Math.floor(x - w / 2) - 2, y - 1, Math.ceil(w) + 4, LH7); ctx.globalAlpha = 1;
        ht(t, x, y + 1, c, 'center', blink ? 0.65 + 0.35 * Math.sin(mapT * 4) : 1); y += LH7;
      }
    } else if (townMsgT < 3) ht(townMsg, LW >> 1, LH - 14, '#d6b98a', 'center', Math.min(1, (3 - townMsgT) * 2));
    // a small count in the corner
    if (mode === 'town' && !window.__clean) {
      ctx.globalAlpha = Math.min(1, Math.max(0, titleOut - 0.4)) * 0.8;
      R.drawGem(ctx, LW - 12, 11, 0.25, P.beaten, gameTime, count() >= NL);
      ht(count() + '/6', LW - 19, 9, '#6b7280', 'right', ctx.globalAlpha);
      if (P.comp) R.drawMini(ctx, 12, 14, gameTime, 'on', 1);
      ctx.globalAlpha = 1;
    }
    if (flash > 0) { ctx.globalAlpha = Math.min(1, flash) * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, LW, LH); ctx.globalAlpha = 1; }
    // the rare seeker wakes
    if (rareCardT < 5.5) {
      const a = Math.min(1, rareCardT / 0.6) * Math.min(1, (5.5 - rareCardT) / 1.0), y0 = Math.round(LH * 0.3);
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#05070b'; ctx.fillRect(0, y0 - 26, LW, 60); ctx.globalAlpha = a;
      R.drawPortrait(ctx, LW / 2 - 46, y0 + 4, 0.75, a);
      ctx.globalAlpha = a;
      ht('A RARE SEEKER WAKES', LW / 2 - 20, y0 - 12, PAL.snow, 'left', a, 2);
      ht('SEEKER NET  #' + P.seekerId + '  -  RARITY ' + rareRank(P.seekerId) + ' OF ' + R.NETN, LW / 2 - 20, y0 + 2, '#9fd3c7', 'left', a);
      ht('#' + P.wellOld + ' SLEEPS IN ITS PLACE', LW / 2 - 20, y0 + 2 + LH7, '#8a919e', 'left', a);
      ctx.globalAlpha = 1;
    }
    // the title, over the town
    const ta = mode === 'title' ? Math.min(1, Math.max(0, (bootFade - 1.0) / 1.8)) : Math.max(0, 1 - titleOut / 0.8);
    if (ta > 0) drawTitleText(ctx, ta);
    // the first fade in from the dark
    // (drawn over the words too, in render)
  }
  function drawTitleText(ctx, a) {
    const cx = LW >> 1; let y = Math.round(LH * 0.16);
    const sc = Math.max(1, Math.min(3, Math.floor(LH / 90), Math.floor((LW - 12) / (R.textWidth('DWELLER') * 2))));
    if (window.__clean) {                               // (for pictures of the town: the name alone)
      ht('DWELLER', cx, Math.round(LH * (window.__logoY || 0.12)), PAL.snow, 'center', a, window.__logoSc || sc * 2);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, 0, LH * 0.6);
    g.addColorStop(0, 'rgba(3,4,8,' + (0.55 * a).toFixed(3) + ')'); g.addColorStop(1, 'rgba(3,4,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH * 0.6);
    const L7 = Math.ceil(7 * HS) + 3, logo = Math.ceil(7 * HS * sc * 2);
    ht('DWELLER', cx, y, PAL.snow, 'center', a, sc * 2);
    const tag = wrap('STAY IN THE DARK  -  REACH THE LIGHT THAT ISNT FIRE', (LW - 16) / HS);
    tag.forEach((t, k) => ht(t, cx, y + logo + 6 + k * L7, PAL.muted, 'center', a * 0.8));
    y += logo + 6 + tag.length * L7;
    if (mode === 'title') {
      ht(touchMode ? 'TAP TO BEGIN' : 'PRESS SPACE TO BEGIN', cx, y + 4, PAL.gold, 'center', a * (0.55 + 0.45 * Math.sin(titleT * 3)));
      if (!touchMode) ht('ESC  TITLE     M  MUTE     F  FULLSCREEN', cx, y + 4 + L7 * 1.5, PAL.muted, 'center', a * 0.5);
    }
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
      P.core = true; delete P.cp[cur]; saveProgress();
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
      } else if (mode === 'title' || mode === 'town') {
        A.Live.update(0.0, 1);
        shake = Math.max(0, shake - dt * 6); flash = Math.max(0, flash - dt * 1.6);
        townFrame(dt);
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
    } else if (mode === 'title' || mode === 'town') {
      drawTown(ctx, dt);
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
    if (mode === 'title' || mode === 'town') {
      flushHT();
      if (bootFade < 2.5) { gctx.globalAlpha = 1 - bootFade / 2.5; gctx.fillStyle = '#000'; gctx.fillRect(0, 0, canvas.width, canvas.height); gctx.globalAlpha = 1; }
    }
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
      R.drawText(ctx, touchMode ? 'TAP HERE  -  TOWN' : 'Q  TOWN', LW >> 1, Math.round(LH * 0.16), '#8a919e', 1, 'center');
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
        if (winT > 2.5) { ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(winT * 3)); R.drawText(ctx, touchMode ? 'TAP FOR THE TOWN' : 'ENTER  TOWN     N  AGAIN', LW >> 1, y0 + 162, PAL.gold, 1, 'center'); }
        ctx.globalAlpha = 1;
        return;
      }
      R.drawText(ctx, 'A SLIVER OF THE CRYSTAL', LW >> 1, y0, R.SHARDS[cur], 2, 'center');
      R.drawText(ctx, ROMAN[cur] + '  ' + NAMES[cur] + '  COMPLETE', LW >> 1, y0 + 22, PAL.gold, 1, 'center');
      const t = winTime;
      R.drawText(ctx, 'TIME  ' + fmtTime(t) + (newBest ? '  NEW BEST' : '') + '     LIGHT FOUND YOU  ' + S_.deaths + ' TIMES', LW >> 1, y0 + 36, PAL.snow, 1, 'center');
      R.drawGem(ctx, LW >> 1, y0 + 70, 0.9, P.beaten, gameTime, count() >= NL);
      R.drawText(ctx, count() + ' OF 6 SLIVERS', LW >> 1, y0 + 92, '#a9b2c0', 1, 'center');
      if (winT > 2.5) { ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(winT * 3)); R.drawText(ctx, touchMode ? 'TAP FOR THE TOWN' : 'ENTER  TOWN     N  AGAIN', LW >> 1, y0 + 108, PAL.gold, 1, 'center'); }
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
    tW = T.build(); townSpawn(); rareChoice();
    if (q.get('speed')) speedMul = Math.max(1, Math.min(32, parseFloat(q.get('speed')) || 1));
    lastT = performance.now();
    requestAnimationFrame(frame);
    // debug / test hooks
    window.__dweller = {
      get state() { return S; }, get world() { return world; }, get mode() { return mode; }, get level() { return cur; }, get progress() { return P; },
      start(fresh) { startLevel(cur < 0 ? 0 : cur, !!fresh); },
      startLevel(i, fresh) { startLevel(i, fresh === undefined ? true : !!fresh); },
      map() { toTown(); }, title() { toTitle(); }, town(f) { toTown(f); }, get townState() { return tS; }, get near() { return near; }, interact(f) { townInteract(!!f); }, teleportTown(x, y) { tS.x = x; tS.y = y; snapTown(); },
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
