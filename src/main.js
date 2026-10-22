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
  const P = { beaten: [false, false, false, false, false, false], best: [0, 0, 0, 0, 0, 0], comp: false, cp: {}, fused: false, core: false, coreBest: 0, seen: {}, codex: [], deepBest: 0, deepRuns: 0, deepWins: 0, archSeen: false, archNew: false, coat: 'sand', coatsSeen: 1 };
  function loadProgress() {
    try {
      const j = JSON.parse(lsGet('dweller.v2') || 'null');
      if (j && Array.isArray(j.beaten)) {
        for (let i = 0; i < NL; i++) { P.beaten[i] = !!j.beaten[i]; P.best[i] = +(j.best && j.best[i]) || 0; }
        P.comp = !!j.comp; P.cp = j.cp && typeof j.cp === 'object' ? j.cp : {}; P.fused = !!j.fused; P.seekerId = j.seekerId; P.core = !!j.core; P.coreBest = +j.coreBest || 0; P.seen = j.seen && typeof j.seen === 'object' ? j.seen : {}; P.snv = j.snv; P.codex = Array.isArray(j.codex) ? j.codex.filter(x => x >= 1) : []; P.deepBest = +j.deepBest || 0; P.deepRuns = +j.deepRuns || 0; P.deepWins = +j.deepWins || 0; P.archSeen = !!j.archSeen; P.archNew = !!j.archNew; P.coat = typeof j.coat === 'string' ? j.coat : 'sand'; P.coatsSeen = +j.coatsSeen || 1;
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
    codexInit();
    wearCoat();
  }
  /* the coats: the weaver makes one for the Guardian, then one at 5, 10, 15, 20, 30 and 35 wins in The Deep */
  const COATS = R.COATS;
  function coatOpen(c) { return c.core ? P.core : c.wins ? P.deepWins >= c.wins : true; }
  function coatsOpen() { return COATS.filter(coatOpen); }
  function coatNeed(c) { return c.core ? 'BEAT THE GUARDIAN' : c.wins + ' WINS IN THE DEEP'; }
  function wearCoat() { let c = COATS.find(q => q.id === P.coat); if (!c || !coatOpen(c)) { c = COATS[0]; P.coat = 'sand'; } R.setCoat(c.main ? c : null); }
  function nextCoat() {
    const open = coatsOpen(), i = open.findIndex(c => c.id === P.coat), c = open[(i + 1) % open.length];
    P.coat = c.id; P.coatsSeen = open.length; saveProgress(); wearCoat();
    A.Live.sfx('check'); flash = 0.25;
    for (let k = 0; k < 24; k++) { const a = Math.random() * 6.283, sp = 8 + Math.random() * 22; R.spawn(tS.x + 2.5, tS.y + 4, Math.cos(a) * sp, Math.sin(a) * sp - 8, 0.5 + Math.random() * 0.6, c.glow || c.main || '#b9a87b', 1, 6, true); }
  }
  function coatWaiting() { return P.core && coatsOpen().length > P.coatsSeen; }
  /* the Codex: every seeker you have found. The one from the mycelium is the first; the rare one under the well joins
     it once; each good run through The Deep adds one more */
  function codexInit() {
    if (!Array.isArray(P.codex)) P.codex = [];
    const add = (id) => { if (id >= 1 && !P.codex.includes(id)) P.codex.push(id); };
    if (P.comp) { if (P.wellUsed && P.wellOld) add(P.wellOld); add(P.seekerId); }
    saveProgress();
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
    } else if (mode === 'deepPick' || mode === 'deepOver' || mode === 'deepWin') { deepKey(e.code); return;
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
      if (RUN) { if (e.code === 'KeyQ' || e.code === 'Backspace') { A.Live.setPaused(false); mode = 'play'; deepOver(true); return; } }
      else if (e.code === 'KeyN') { A.Live.setPaused(false); startLevel(cur, true); return; }
      else if (e.code === 'KeyQ' || e.code === 'Backspace') { A.Live.setPaused(false); toTown(cur); return; }
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
    else if (mode === 'deepPick' || mode === 'deepOver' || mode === 'deepWin') deepTap(fx * LW, fy * LH);
    else if (mode === 'pause') {
      if (e.pointerType !== 'touch') { setPause(false); return; }
      if (fy < 0.3) { A.Live.setPaused(false); if (RUN) { mode = 'play'; deepOver(true); } else toTown(cur); }
      else if (fy > 0.68 && !RUN) { A.Live.setPaused(false); startLevel(cur, true); }
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
      else if (mode === 'deepPick' || mode === 'deepOver' || mode === 'deepWin') {
        const key = deepKey;
        if (edge('a', b(0))) key('Enter');
        if (edge('b', b(1))) key('Escape');
        if (edge('pl', b(14) || ax < -0.6)) key('ArrowLeft');
        if (edge('pr', b(15) || ax > 0.6)) key('ArrowRight');
        if (edge('pu', b(12) || ay < -0.6)) key('ArrowUp');
        if (edge('pd', b(13) || ay > 0.6)) key('ArrowDown');
      }
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
    SC = Math.max(1, Math.round(ch / (window.__viewH || ((cur === CORE || cur === 7) && mode !== 'town' && mode !== 'title' ? (cur === 7 ? 320 : 360) : 230))));   // the Guardian's arena is seen from further back
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
  function fitView() { const k = (cur === CORE || cur === 7) && mode !== 'town' && mode !== 'title' ? (cur === 7 ? 2 : 1) : 0; if (k !== scFor) { scFor = k; resize(); } }
  function startLevel(i, fresh) {
    audioInit(); ARCH = null;
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
    if (i !== sectionIdx && RUN) { sectionIdx = i; return; }
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
  let leadX = null, leadY = null;
  const LINES = {
    collector: () => [
      'THE WELL IS DEEPER THAN IT LOOKS', 'I KEEP WHAT THE LIGHT LEAVES BEHIND', 'DONT STAND UNDER THE LAMPS TOO LONG',
      'SOME SEEKERS SLEEP WHERE NOBODY LOOKS',
    ].concat(P.wellUsed ? ['YOU WOKE THE ONE DOWN THERE. GOOD'] : []),
    // the weaver: coats for those who have earned one. Until the Guardian falls he has nothing for you
    weaver: () => P.core ? (coatWaiting() ? ['FINALLY. SOMETHING WORTH WEARING. TRY IT ON'] : ['EVERY COAT I MAKE IS CUT FROM SOMEWHERE DOWN THERE', 'GO DEEPER. COME BACK. I WILL HAVE SOMETHING']) : ['NICE CLOAK. DID YOU FIND IT IN A DITCH', 'THAT RAG? I DONT DRESS NOBODIES. GO DO SOMETHING'],
    exiled: () => [
      'THEY SENT ME UP. I DONT GO DOWN ANYMORE', 'EVERY DOOR IN THIS TOWN GOES FURTHER DOWN', 'THE MOUNTAIN WAS HERE BEFORE THE TOWN. SO WAS THE DOOR',
      'IF THE TREES BLINK, STAND STILL', 'NOBODY LIGHTS THE LAMPS. NOBODY WANTS TO BE SEEN',
    ].concat(P.beaten[1] && !P.comp ? ['THE MYCELIUM HAS A FALSE WALL. SOMETHING SLEEPS BEHIND IT', 'THE MYCELIUM HAS A FALSE WALL. SOMETHING SLEEPS BEHIND IT'] : []).concat(count() >= 3 ? ['YOUR DOORS ARE BURNING NICELY'] : [])
     .concat(count() >= NL && !P.core ? ['THE GREAT DOOR IS HUMMING. GO ON'] : []),
    // the silent one speaks only once the Guardian is gone, and always in this order
    monk: () => P.core ? (P.archSeen ? [] : ['GO BACK THROUGH THE DOOR. IT KEPT SOMETHING FOR YOU']).concat(['YOU BROKE THE GUARDIAN', 'IT WAS NOT KEEPING YOU OUT', 'IT WAS KEEPING SOMETHING IN', 'GO BACK DOWN IF YOU LIKE. IT IS LISTENING NOW', 'WHERE IT HUNG THERE IS AN ARCHIVE NOW. AND A WAY DOWN']) : ['...'],
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
    ARCH = null;
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
      if (P.core && built(ARCHL)) { A.Live.sfx('check'); startArchive(); return; }
      if (built(CORE)) startLevel(CORE, fresh);
    } else if (near.k === 'res' && near.q.id === 'weaver' && P.core) {
      nextCoat();
    } else if (near.k === 'res') {
      const L = LINES[near.q.id](); talk[near.q.id] = ((talk[near.q.id] || 0) + 1) % L.length; A.Live.sfx('ui');
    } else if (near.k === 'rare') wakeRare();
  }
  /* the sleeper under the well: a bonus seeker, any one of SEEKER NET you do not have yet. Once per save it wakes,
     joins your Codex and follows you */
  function rareChoice() {
    if (!(P.rareId >= 1) && R.NETN > 1) { let q, k = 0; do { q = 1 + Math.floor(Math.random() * R.NETN); } while ((q === P.seekerId || P.codex.includes(q)) && ++k < 100); P.rareId = q; saveProgress(); }
    return P.rareId;
  }
  /* a seeker's tier in The Deep (S best .. D), from its traits */
  const GRADE = {};
  function gradeOf(id) { return GRADE[id] || (GRADE[id] = window.DwellerDeep.grade(R.seekerTraits(id))); }
  function gradeLine(id) { return gradeOf(id) + ' - TIER'; }
  function wakeRare() {
    if (P.wellUsed) return say('THE CAVE IS EMPTY NOW');
    if (!P.comp) return say('IT SLEEPS. IT WAITS FOR A SEEKER OF YOUR OWN', 'nope');
    const id = rareChoice();
    P.wellOld = 0; P.seekerId = id; P.wellUsed = true; if (!P.codex.includes(id)) P.codex.push(id); if (P.core) P.archNew = true; saveProgress();
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
    if (P.core && !P.archSeen && tS.cmp && mode === 'town') {
      const px = tS.x + 2.5, dir = Math.sign(T.GREAT.x - px) || 1, dist = Math.abs(T.GREAT.x - px);
      const tx = dist < 50 ? T.GREAT.x - 10 : px + dir * 46, ty = groundY(tx) - 18 + Math.sin(gameTime * 3) * 2;
      leadX = leadX === null ? tS.cmpX : leadX + (tx - leadX) * (1 - Math.exp(-dt * 1.6)); leadY = leadY === null ? tS.cmpY : leadY + (ty - leadY) * (1 - Math.exp(-dt * 2));
      tS.cmpX = leadX; tS.cmpY = leadY;
    } else { leadX = leadY = null; }
    R.updateParticles(dt);
    const t = townCamTarget(), kx = 1 - Math.exp(-dt * 5.5), ky = 1 - Math.exp(-dt * 4.5);
    if (window.__townCam !== undefined) { t[0] = Math.max(0, Math.min(T.WPX - LW, window.__townCam - LW / 2)); }   // (for pictures of the town)
    tcamX += (t[0] - tcamX) * kx; tcamY += (t[1] - tcamY) * ky;
    const nn = townNear(), key = nn ? nn.k + (nn.i !== undefined ? nn.i : nn.q ? nn.q.id : '') : '';
    if (key !== nearKey) {
      nearKey = key; townMsgT = 99;
      if (nn && nn.k === 'res') { const L = LINES[nn.q.id](); talk[nn.q.id] = nn.q.id === 'monk' || nn.q.id === 'weaver' ? (talk[nn.q.id] === undefined ? 0 : (talk[nn.q.id] + 1) % L.length) : Math.floor(Math.random() * L.length); }
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
  function htW(t, sc) { return R.textWidth(t) * (sc < 0 ? Math.max(1, HK - 1) / SC : HS * (sc || 1)); }   // sc -1: a step smaller than half size
  function halfText() { HK = Math.max(1, Math.round(SC / 2)); HS = HK / SC; HT.length = 0; ctxAlpha = 1; }
  function flushHT() {
    for (const [t, x, y, col, al, a, sc] of HT) {
      if (a <= 0) continue;
      const sp = R.textSprite(t, col), k = sc < 0 ? Math.max(1, HK - 1) : HK * sc, w = sp.width * k;
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
    halfText();
    const LH7 = Math.ceil(7 * HS) + 3;          // one line of half-size text, with its gap
    T.draw(ctx, {
      text: (t, x, y, c, al) => ht(t, x, y, c, al, 1), s: tS, camX: tcamX + sx, camY: tcamY, camY0, LW, LH, time: gameTime, dt, P, still, fuse: fuseT, flare,
      inRoom: tS.y + tS.h > (T.WELL.room[2] + 1) * D.TS,
      unlocked: (i) => built(i) && unlocked(i), rareId: rareChoice(), rareUsed: !!P.wellUsed, coatNew: coatWaiting() ? coatsOpen()[coatsOpen().length - 1] : null, oldId: 0,
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
        lines.push([P.core ? 'THE CODEX' : P.fused ? 'VII  THE CORE' : 'THE GREAT DOOR', P.core ? '#9fd3c7' : all ? PAL.snow : '#a9b2c0']);
        if (!all) lines.push([count() + ' OF 6 SLIVERS  -  IT WANTS THE WHOLE CRYSTAL', '#8a919e']);
        else if (!P.fused) lines.push([key + '  SET THE CRYSTAL', PAL.gold, true]);
        else {
          if (P.core) { lines.push([P.codex.length + ' OF ' + R.NETN + ' SEEKERS  -  THE GUARDIAN IS GONE', '#d6dbe4']); lines.push([key + '  ENTER', PAL.gold, true]); if (P.archNew) lines.push(['A NEW SEEKER WAITS INSIDE', '#b4c8ff']); }
          else {
            lines.push(['A GUARDIAN WAITS BELOW', '#d6dbe4']);
            lines.push([key + '  ' + (sv && sv.cp > 0 ? 'CONTINUE FROM THE THIRD SLIVER' : 'DESCEND'), PAL.gold, true]);
            if (sv && sv.cp > 0 && !touchMode) lines.push(['N  FROM THE TOP', '#8a919e']);
          }
        }
      } else if (near.k === 'res') {
        const L = LINES[near.q.id](), t = L[(talk[near.q.id] || 0) % L.length];
        for (const w of wrap(t, Math.min(200, LW - 24) / HS)) lines.push([w, near.q.id === 'monk' && !P.core ? '#6b7280' : '#c3cbd6']);
        if (near.q.id === 'weaver' && P.core) {
          const cur = COATS.find(c => c.id === P.coat) || COATS[0], nx = COATS.find(c => !coatOpen(c)), n = coatsOpen().length;
          lines.push(['YOU WEAR  ' + cur.name + '   -   ' + n + ' OF ' + COATS.length + ' COATS', '#d6dbe4']);
          if (n > 1) lines.push([key + '  ANOTHER COAT', PAL.gold, true]);
          if (nx) lines.push(['NEXT  ' + nx.name + '  -  ' + coatNeed(nx), '#6b7280']);
        } else if (L.length > 1) lines.push([key + '  MORE', '#5d6474', false, -1]);
      } else if (near.k === 'rare') {
        if (P.wellUsed) lines.push(['THE CAVE IS EMPTY NOW', '#7f9aa6']);
        else {
          lines.push(['A SEEKER SLEEPS HERE', '#9fd3c7']);
          lines.push(['SEEKER NET #' + rareChoice() + '  -  ' + gradeLine(rareChoice()), '#7f9aa6']);
          if (P.comp) { lines.push([key + '  WAKE IT  -  IT JOINS YOUR CODEX', PAL.gold, true]); lines.push(['IT WAKES ONLY ONCE', '#5d6474']); }
          else lines.push(['IT WAITS FOR A SEEKER OF YOUR OWN', '#6b7280']);
        }
      }
    }
    if (townMsgT < 3) lines.push([townMsg, '#d6b98a']);
    if (window.__clean) lines.length = 0;                // (for pictures of the town)
    if (lines.length && near) {
      let y = Math.round(near.y + 8 - cy - lines.length * LH7);
      y = Math.max(4, y);
      for (const [t, c, blink, sc] of lines) {
        const w = htW(t, sc), x = Math.max(w / 2 + 3, Math.min(LW - w / 2 - 3, near.x - cx));
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#05060a'; ctx.fillRect(Math.floor(x - w / 2) - 2, y - 1, Math.ceil(w) + 4, LH7); ctx.globalAlpha = 1;
        ht(t, x, y + 1 + (sc < 0 ? 1 : 0), c, 'center', blink ? 0.65 + 0.35 * Math.sin(mapT * 4) : 1, sc); y += LH7;
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
    // the seeker under the well wakes
    if (rareCardT < 5.5) {
      const a = Math.min(1, rareCardT / 0.6) * Math.min(1, (5.5 - rareCardT) / 1.0), y0 = Math.round(LH * 0.3);
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#05070b'; ctx.fillRect(0, y0 - 26, LW, 60); ctx.globalAlpha = a;
      R.drawPortrait(ctx, LW / 2 - 46, y0 + 4, 0.75, a);
      ctx.globalAlpha = a;
      ht('A SEEKER WAKES', LW / 2 - 20, y0 - 12, PAL.snow, 'left', a, 2);
      ht('SEEKER NET  #' + P.seekerId + '  -  ' + gradeLine(P.seekerId), LW / 2 - 20, y0 + 2, '#9fd3c7', 'left', a);
      ht('IT JOINS YOUR CODEX  -  AND FOLLOWS YOU NOW', LW / 2 - 20, y0 + 2 + LH7, '#8a919e', 'left', a);
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
  /* ------------------------------------------------------------ THE DEEP and THE CODEX
   * The Codex opens under the mountain once the Guardian is gone: every seeker you have found, the one that comes
   * with you, and the way into The Deep. A run there is eight rooms through two strata, one life, an upgrade
   * between rooms, and at the bottom a seeker you have not found yet. Your seeker's traits only act down there. */
  const DP = window.DwellerDeep, DEEPROOMS = window.DWELLER_DEEP || [];
  let RUN = null, deepSpool = null, deepT = 0, deepSel = 1, deepOffer = [], deepNew = 0, deepMsgT = 99, deepMsgS = '', deepRecord = false;
  const ROOT_SEQ = [0, 4, 2, 5, 1, 3, 0, 4];
  // a descent's keys: it always starts at home and ends on the dominant, the rooms between in their own order
  function deepKeys() { const mid = [4, 2, 5, 1, 3, 0]; for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; } return [0].concat(mid, [4]); }
  function deepMsg(t) { deepMsgS = t; deepMsgT = 0; }
  let STRONG = null;     // every seeker of tier S or A in The Deep
  function strongIds() { if (!STRONG) { STRONG = []; for (let id = 1; id <= R.NETN; id++) if ('SA'.includes(gradeOf(id))) STRONG.push(id); } return STRONG; }
  function startDeep() {
    ARCH = null;
    if (!DEEPROOMS.length) return;
    const tr = R.seekerTraits(P.seekerId);
    const tier = DP.tierFor(P.codex.length);
    const m0 = DP.modsFor(tr, []);
    RUN = { rooms: DP.planRun(Math.random, DEEPROOMS), i: 0, picks: [], tier, ticks: 0, traits: tr, shields: m0.shield || 0, rare: m0.rare || 0,
      music: 1 + Math.floor(Math.random() * 1e9), keys: deepKeys() };   // each descent its own music, and its own order of keys
    P.deepRuns++; saveProgress();
    A.Live.setTheme(7); A.Live.deep = { k: 0, seed: RUN.music };
    loadDeepRoom(0);
  }
  function loadDeepRoom(i) {
    RUN.i = i;
    const base = DEEPROOMS.find(r => r.id === RUN.rooms[i]);
    const L = D.deepTier(base, RUN.tier);
    if (i === RUN.rooms.length - 1) {
      // the bottom: a chest where the gate would be. Press E and it opens; what is inside rises out (on the wins that
      // earn a coat, a spool of its thread instead of a seeker)
      L.deepFinal = true;
      const sc = COATS.find(c => c.wins === P.deepWins + 1);
      L.chest = { x: L.goal.x, y: L.goal.y, t: 0, rise: 0, shake: 0, T: -1, near: false, ePrev: false, spool: sc || null, id: 0 };
      L.goal = { x: -99999, y: -99999 };
    } else {
      // the gate glows in the colour of the room beyond
      const nx = DEEPROOMS.find(r => r.id === RUN.rooms[i + 1]); L.nextTheme = nx ? nx.theme : L.theme;
    }
    world = D.makeWorld(L); R.prepare(world, L.theme, L.stratum); cur = 100 + i;
    S = D.newState(world, { companion: true, mods: DP.modsFor(RUN.traits, RUN.picks) }); S.shields = RUN.shields;
    runTicks = 0; R.parts.length = 0; R.clearGuardian(); A.Live.boss = null; R.resetTethers(); beamPrev = {}; deathFade = 0; flash = 0; shake = 0;
    seekerCardT = 99; newBest = false;
    mode = 'play'; sectionIdx = -1;
    cardText = DP.STRATUM_NAMES[L.stratum] + '  -  ' + (i + 1) + ' OF ' + RUN.rooms.length; cardT = 0;
    snapCamera(); A.Live.sfx('start'); A.Live.setPaused(false); syncTouchUI();
  }
  function deepRoomDone() {
    RUN.ticks += runTicks;
    if (RUN.i >= RUN.rooms.length - 1) return deepWinNow();
    deepOffer = DP.offer(Math.random, RUN.picks); deepSel = Math.min(1, deepOffer.length - 1);
    mode = 'deepPick'; deepT = 0; syncTouchUI();
  }
  function deepTake() {
    const u = deepOffer[deepSel]; if (!u) return;
    RUN.picks.push(u.id); if (u.m.shield) RUN.shields += u.m.shield;
    A.Live.sfx('check');
    loadDeepRoom(RUN.i + 1);
  }
  /* the chest: stand by it, press E. It shivers, the lid lifts and is thrown back, the find rises and hangs there,
     then the run is won */
  function chestStep(inp) {
    const ch = world.level.chest, dt = 1 / D.TICK;
    const e = !!(inp & IN.E);
    ch.near = !S.dead && Math.abs(S.x + 2.5 - ch.x) < 18 && Math.abs(S.y + S.h / 2 - ch.y) < 16;
    if (ch.T < 0) {
      if (ch.near && e && !ch.ePrev) {
        ch.T = 0; A.Live.sfx('check');
        if (!ch.spool) ch.id = DP.reward(Math.random, P.codex, R.NETN, strongIds(), RUN.tier, RUN.rare);
      }
      ch.ePrev = e; return;
    }
    const was = ch.T; ch.T += dt;
    ch.shake = ch.T < 0.45 ? (Math.floor(ch.T * 24) % 2 ? 1 : -1) : 0;
    ch.t = Math.max(0, Math.min(1, (ch.T - 0.45) / 0.45));
    ch.rise = Math.max(0, Math.min(1, (ch.T - 0.9) / 0.9));
    if (was < 0.9 && ch.T >= 0.9) { A.Live.sfx('seeker'); flash = 0.35; for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, sp = 10 + Math.random() * 40; R.spawn(ch.x, ch.y - 4, Math.cos(a) * sp, Math.sin(a) * sp - 20, 0.6 + Math.random(), k % 2 ? '#d5f8fc' : '#5daa99', 1, 8, true); } }
    if (ch.T >= 2.8 && mode === 'play') { RUN.ticks += runTicks; runTicks = 0; deepWinNow(ch.id); }
  }
  function deepWinNow(chestId) {
    deepSpool = COATS.find(c => c.wins === P.deepWins + 1) || null;
    const id = deepSpool ? 0 : chestId || DP.reward(Math.random, P.codex, R.NETN, strongIds(), RUN.tier, RUN.rare);
    if (id) { P.codex.push(id); P.archNew = true; }
    deepRecord = RUN.rooms.length > P.deepBest; P.deepBest = Math.max(P.deepBest, RUN.rooms.length); P.deepWins++; saveProgress();
    deepNew = id; mode = 'deepWin'; deepT = 0; A.Live.sfx('seeker'); A.Live.sfx('win'); flash = 1;
    syncTouchUI();
  }
  function deepOver(gaveUp) {
    if (!RUN) return;
    RUN.ticks += runTicks; RUN.gaveUp = gaveUp;
    const reached = RUN.i + 1;
    deepRecord = reached > P.deepBest; P.deepBest = Math.max(P.deepBest, reached); saveProgress();
    mode = 'deepOver'; deepT = 0; syncTouchUI();
  }
  function deepKey(code) {
    if (mode === 'deepPick') {
      if (['ArrowLeft', 'KeyA'].includes(code)) { deepSel = Math.max(0, deepSel - 1); A.Live.sfx('ui'); }
      else if (['ArrowRight', 'KeyD'].includes(code)) { deepSel = Math.min(deepOffer.length - 1, deepSel + 1); A.Live.sfx('ui'); }
      else if (['Enter', 'Space', 'KeyE', 'KeyZ', 'KeyK'].includes(code) && deepT > 0.6) deepTake();
      return;
    }
    if (['Enter', 'Space', 'KeyE', 'Escape', 'KeyZ', 'KeyK'].includes(code) && deepT > 1.5) toCodex(mode === 'deepWin' && deepNew ? deepNew : undefined);
  }
  function pickCards() {
    const n = deepOffer.length, gap = 6, w = Math.min(120, Math.floor((LW - 16 - gap * (n - 1)) / n)), h = 64;
    const x0 = Math.round((LW - (w * n + gap * (n - 1))) / 2), y0 = Math.round(LH * 0.36);
    return deepOffer.map((u, i) => ({ x: x0 + i * (w + gap), y: y0, w, h, u }));
  }
  function deepTap(x, y) {
    if (mode === 'deepPick') {
      const c = pickCards().findIndex(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
      if (c < 0) return;
      if (c === deepSel && deepT > 0.6) deepTake(); else { deepSel = c; A.Live.sfx('ui'); }
      return;
    }
    if (deepT > 1.5) toCodex(mode === 'deepWin' && deepNew ? deepNew : undefined);
  }
  function setCompanion(id) { if (P.seekerId === id) return; P.seekerId = id; R.setSeeker(id); saveProgress(); A.Live.sfx('ui'); }

  /* ---- THE CODEX: the Guardian's arena after the Core is won (level VIII, built from VII by tools/archive.py).
   * Your seekers float where they rest, the strongest in The Deep highest; stand in front of one and it wakes, and the Guardian's
   * empty shell opens like an eye to show it; press E and it comes with you. The Guardian's hole is the way into
   * The Deep. Nothing here can hurt you. */
  const ARCHL = 7;
  let ARCH = null;
  const SCORE = {};
  function scoreOf(id) { return SCORE[id] !== undefined ? SCORE[id] : (SCORE[id] = DP.score(R.seekerTraits(id))); }
  function archPlace() {
    const A0 = world.level.archive, comp = P.seekerId;
    const newest = P.codex.length ? P.codex[P.codex.length - 1] : 0;
    const rest = P.codex.filter(id => id !== comp && id !== newest);
    // the best at the top: tiers S and A on the two highest tiers of balconies, B in the middle, C and D below; each
    // band in order of strength from the top down, and a full band passes its weakest down to the next
    const best = (a, b) => scoreOf(b) - scoreOf(a) || a - b;
    const put = (list, band, name) => band.slice(0, list.length).map((p, i) => ({ x: p[0], y: p[1], id: list[i], band: name }));
    const g = (id) => gradeOf(id);
    let carry = rest.filter(id => 'SA'.includes(g(id))).sort(best);
    const high = put(carry.slice(0, A0.high.length), A0.high, 'high');
    carry = carry.slice(A0.high.length).concat(rest.filter(id => g(id) === 'B')).sort(best);
    const wall = put(carry.slice(0, A0.wall.length), A0.wall, 'wall');
    carry = carry.slice(A0.wall.length).concat(rest.filter(id => 'CD'.includes(g(id)))).sort(best);
    const floor = put(carry.slice(0, A0.floor.length), A0.floor, 'floor');
    const over = carry.slice(A0.floor.length);
    const empty = [];
    for (const [band, used] of [[A0.high, high.length], [A0.wall, wall.length], [A0.floor, floor.length]]) for (let i = used; i < band.length; i++) empty.push(band[i]);
    const slots = high.concat(wall, floor);
    if (newest && newest !== comp) slots.push({ x: A0.pedestal[0], y: A0.pedestal[1], id: newest, band: 'new' });
    return { slots, empty, over, key: P.codex.join(',') + '|' + comp };
  }
  function startArchive(returnId) {
    RUN = null;
    loadLevel(ARCHL);
    S = D.newState(world, { companion: true }); runTicks = 0; R.parts.length = 0; R.clearGuardian(); A.Live.boss = null; R.resetTethers();
    deathFade = 0; flash = 0; shake = 0; seekerCardT = 99; newBest = false;
    const A0 = world.level.archive;
    if (returnId !== undefined) { const x = A0.pedestal[0] - 14; S.x = x - 2.5; S.y = A0.pedestal[1] + 6 - 10; S.cmpX = x - 9; S.cmpY = S.y - 12; }
    ARCH = { focus: 0, shut: 0, iris: 0, swap: null, place: null, cycle: 0, ovI: 0, t: 0, ePrev: false };
    mode = 'play'; sectionIdx = -1; cardT = 99; snapCamera();
    A.Live.setTheme(7); A.Live.deep = { k: 0 }; A.Live.setMood(0.06, 0); A.Live.setPaused(false);
    P.archSeen = true; P.archNew = false; saveProgress();
    syncTouchUI();
  }
  function toCodex(id) { startArchive(id === undefined ? 0 : id); }
  function archFrame(dt) {
    const A0 = world.level.archive;
    ARCH.t += dt;
    if (!ARCH.place || ARCH.place.key !== P.codex.join(',') + '|' + P.seekerId) ARCH.place = archPlace();
    const px = S.x + 2.5, feet = S.y + S.h;
    let f = null;
    for (const sl of ARCH.place.slots) if (Math.abs(px - sl.x) < 9 && feet <= sl.y + 1 && feet > sl.y - 16) { f = sl; break; }
    // under the shell, the seekers that have drifted back into the dark come forward one by one
    const under = !f && ARCH.place.over.length && Math.abs(px - A0.core[0]) < 26 && feet > A0.hole[2] - 2;
    if (under) { ARCH.cycle += dt; if (ARCH.cycle > 2.4) { ARCH.cycle = 0; ARCH.ovI = (ARCH.ovI + 1) % ARCH.place.over.length; } f = { id: ARCH.place.over[ARCH.ovI], x: A0.core[0], y: A0.core[1] + 40, band: 'over' }; }
    const id = f ? f.id : 0;
    if (id !== ARCH.focus) { if (id) A.Live.sfx('ui'); ARCH.focus = id; ARCH.focusSlot = f; }
    ARCH.iris += ((id ? 1 : 0) - ARCH.iris) * (1 - Math.exp(-dt * 4));
    if (ARCH.swap) { ARCH.swap.t += dt; if (ARCH.swap.t > 1.4) ARCH.swap = null; }
  }
  function archInteract() {
    if (!ARCH || !ARCH.focus || ARCH.focus === P.seekerId) return;
    const sl = ARCH.focusSlot, old = P.seekerId;
    ARCH.swap = { t: 0, newId: ARCH.focus, oldId: old, x: sl.x, y: sl.y - 17, cx: S.cmpX, cy: S.cmpY };
    setCompanion(ARCH.focus); A.Live.sfx('seeker');
    S.cmpX = sl.x; S.cmpY = sl.y - 17;            // it leaves its place and comes to you
  }
  const AR = window.DwellerArchive;
  function archSt() { return { L: world.level, time: gameTime, pl: ARCH.place || (ARCH.place = archPlace()), focus: ARCH.focus, iris: ARCH.iris, LW, LH, S, dt: frameDt }; }
  function drawArchive(ctx, cx, cy) {
    const A0 = world.level.archive, time = gameTime, Rr = R, SH = R.SHARDS, pl = ARCH.place || archPlace();
    const g = (x, y, r, rgb, a) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    const bx = A0.core[0] - cx, by = A0.core[1] - cy;
    // the seekers that have drifted back into the dark: a slow field of small lights behind the room
    pl.over.forEach((id, i) => {
      const a = i * 2.399 + time * 0.02, rr = 80 + (i * 37) % 140, x = bx + Math.cos(a) * rr * 1.6, y = by - 40 + Math.sin(a) * rr * 0.55;
      ctx.globalAlpha = 0.22; Rr.drawPortrait(ctx, x, y, 0.16, 0.22, id); ctx.globalAlpha = 1;
    });
    AR.drawFront(ctx, cx, cy, archSt());
    // the threads from the six slivers into the shell
    ctx.globalCompositeOperation = 'lighter';
    A0.alcoves.forEach((a, i) => {
      const ax = a[0] - cx, ay = a[1] - 14 - cy, n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
      for (let k = 0; k < n; k++) {
        const u = k / n, pulse = Math.max(0, Math.sin((u * 6 - time * 1.2 + i) * Math.PI));
        ctx.globalAlpha = 0.10 + 0.45 * Math.pow(pulse, 6); ctx.fillStyle = SH[i];
        ctx.fillRect(Math.round(ax + (bx - ax) * u), Math.round(ay + (by - ay) * u - Math.sin(u * Math.PI) * 10), 1, 1);
      }
      ctx.globalAlpha = 1;
      g(ax, ay + 4, 18, '255,255,255', 0.06);
    });
    ctx.globalCompositeOperation = 'source-over';
    // the slivers, set for good
    A0.alcoves.forEach((a, i) => Rr.drawShard(ctx, a[0] - cx, a[1] - cy - 13 + Math.sin(time * 1.7 + i) * 1.2, SH[i], time, 0, 0.55));
    // the Prime: it breathes while it waits, and parts open when a seeker wakes; the glass at its heart grows from 20 to 28
    const ir = ARCH.iris;
    AR.drawPrime(ctx, bx, by, ir, time); ctx.globalAlpha = 1;   // the Prime hangs where the Guardian did
    const rr = Math.round(20 + 8 * ir);
    ctx.globalCompositeOperation = 'lighter'; g(bx, by, rr + 8, '120,210,195', 0.25 + 0.2 * ir); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6,18,20,0.86)'; ctx.beginPath(); ctx.arc(bx, by, rr, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(150,230,215,' + (0.4 + 0.3 * ir).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx + 0.5, by + 0.5, rr, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(150,230,215,0.05)'; for (let y = -rr; y < rr; y += 2) ctx.fillRect(bx - rr, by + y, rr * 2, 1);
    for (const sl of pl.slots) {
      const x = sl.x - cx, y = sl.y - cy;
      if (x < -40 || x > LW + 40 || y < -60 || y > LH + 40) continue;
      if (ARCH.swap && ARCH.swap.newId === sl.id && ARCH.swap.t < 1.4) continue;
      const on = sl.id === ARCH.focus, bob = Math.sin(time * 1.3 + sl.x * 0.01) * 1.5, isNew = sl.band === 'new';
      Rr.drawPortrait(ctx, x, y - 17 + bob, on ? 0.36 : 0.28, on ? 1 : 0.72, sl.id);
      if (isNew) ht('NEW', x, y - 34, '#b4c8ff', 'center', 0.5 + 0.4 * Math.sin(time * 3));
      if (on) {
        ctx.globalCompositeOperation = 'lighter';
        const n = Math.ceil(Math.hypot(bx - x, by - (y - 17)) / 2);
        for (let k = 0; k < n; k++) { const u = k / n; ctx.globalAlpha = 0.22 + 0.22 * Math.sin(u * 30 - time * 8); ctx.fillStyle = '#a8f0e0'; ctx.fillRect(Math.round(x + (bx - x) * u), Math.round(y - 17 + (by - y + 17) * u), 1, 1); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    // a seeker changing places with your companion
    if (ARCH.swap) {
      const w2 = ARCH.swap, u = Math.min(1, w2.t / 1.2), e = u * u * (3 - 2 * u);
      Rr.drawPortrait(ctx, (S.cmpX - cx) + (w2.x - S.cmpX) * e, (S.cmpY - cy) + (w2.y - S.cmpY) * e - Math.sin(e * Math.PI) * 14, 0.28, 0.9, w2.oldId);
    }
    // what the glass shows
    const L7 = Math.ceil(7 * HS) + 3;
    if (ARCH.focus && ARCH.iris > 0.2) {
      const id = ARCH.focus;
      ctx.globalAlpha = Math.min(1, ARCH.iris * 1.4); Rr.drawPortrait(ctx, bx, by - 1, 0.9, ctx.globalAlpha, id); ctx.globalAlpha = 1;
      const tr = Rr.seekerTraits(id) || {}, gd = gradeOf(id), mine = P.seekerId, cmp = id !== mine && mine >= 1;
      const myAb = cmp ? DP.abilities(Rr.seekerTraits(mine)) : [], theirAb = DP.abilities(tr);
      const myWords = new Set(myAb.map(a => a[1])), theirWords = new Set(theirAb.map(a => a[1]));
      // how it measures against the seeker you have now
      let verdict = null;
      if (cmp) { const d = scoreOf(id) - scoreOf(mine); verdict = d > 0.5 ? ['STRONGER THAN YOURS', '#9fe0a8'] : d < -0.5 ? ['WEAKER THAN YOURS', '#c99a9a'] : ['AS STRONG AS YOURS', '#a9b4bf']; }
      const lines = [['SEEKER NET  #' + id + '  -  ' + ((tr.Base || '') + '  ' + (tr.Colorway || '')).toUpperCase(), '#e6f2f0'], [gradeLine(id), DP.GRADE_COL[gd]]]
        .concat(verdict ? [verdict] : [])
        .concat(theirAb.map(a => cmp && !myWords.has(a[1]) ? ['+ ' + a[1], '#c8f2d2'] : [a[1], '#bfe3dc']))      // what it would bring
        .concat([id === mine ? ['YOUR COMPANION', '#9fd3c7'] : [(touchMode ? 'ENTER' : 'E') + '  TAKE IT WITH YOU', PAL.gold]]);
      // the seeker you have now, in a smaller, quieter box beneath: no picture, its tier and what it does
      const cur = cmp ? [['CURRENT SEEKER  #' + mine, '#7f9aa6'], [gradeLine(mine), DP.GRADE_COL[gradeOf(mine)]]]
        .concat(myAb.map(a => theirWords.has(a[1]) ? [a[1], '#7f8e96'] : ['- ' + a[1], '#c4a3a3'])) : [];   // what you would give up
      const tw = Math.max(...lines.map(l => R.textWidth(l[0]))) * HS + 14, th = lines.length * L7 + 6;
      const cw = cur.length ? Math.max(...cur.map(l => R.textWidth(l[0]))) * HS + 12 : 0, chh = cur.length ? cur.length * L7 + 5 : 0, gap = cur.length ? 4 : 0;
      const above = S.y + S.h < A0.core[1] - 20;
      const ty = above ? by - 90 - th - gap - chh : by + 88;                   // clear of the Prime: above it when you are above it
      const cy2 = ty + th + gap, tx = bx - tw / 2, cx2 = bx - cw / 2;
      ctx.globalCompositeOperation = 'lighter'; g(bx, ty + th / 2, tw * 0.7, '90,170,160', 0.12); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(8,20,22,0.82)'; ctx.fillRect(Math.round(tx), ty, Math.round(tw), th);
      ctx.fillStyle = 'rgba(150,230,215,0.5)'; ctx.fillRect(Math.round(tx), ty, Math.round(tw), 1); ctx.fillRect(Math.round(tx), ty + th - 1, Math.round(tw), 1);
      lines.forEach((l, k) => ht(l[0], bx, ty + 4 + k * L7, l[1], 'center', k === lines.length - 1 && id !== mine ? 0.65 + 0.35 * Math.sin(time * 4) : 1));
      if (cur.length) {
        ctx.fillStyle = 'rgba(6,14,16,0.72)'; ctx.fillRect(Math.round(cx2), cy2, Math.round(cw), chh);
        ctx.fillStyle = 'rgba(150,230,215,0.22)'; ctx.fillRect(Math.round(cx2), cy2, Math.round(cw), 1); ctx.fillRect(Math.round(cx2), cy2 + chh - 1, Math.round(cw), 1);
        ctx.fillStyle = 'rgba(150,230,215,0.35)'; ctx.fillRect(Math.round(bx), cy2 - gap, 1, gap);                       // a thread joining the two
        cur.forEach((l, k) => ht(l[0], bx, cy2 + 3 + k * L7, l[1], 'center', 0.9));
      }
    } else {
      ht('THE', bx, by - 12, '#9fd3c7', 'center', 1);
      ht('CODEX', bx, by - 4, '#e6f2f0', 'center', 1, 2);
      ht(P.codex.length + ' / ' + R.NETN, bx, by + 9, '#7f9aa6', 'center', 1);
    }
    // the way down, where the Guardian broke the floor, and how deep you have been
    const hx = (A0.hole[0] + A0.hole[1]) / 2 - cx, hy = A0.hole[2] - cy;
    ctx.globalCompositeOperation = 'lighter'; g(hx, hy + 18, 44, '120,150,230', 0.16 + 0.04 * Math.sin(time * 1.4)); ctx.globalCompositeOperation = 'source-over';
    ht('THE DEEP', hx, hy + 20, '#c9d6f0', 'center', 0.85);
    const RM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    if (P.deepBest) ht('DEEPEST  ' + RM[Math.min(8, P.deepBest)] + ' OF VIII', hx, hy + 20 + L7, '#6f7f9c', 'center', 0.7);
    if (Math.abs(S.x + 2.5 - (A0.hole[0] + A0.hole[1]) / 2) < 40 && S.y + S.h <= A0.hole[2] + 2) ht((touchMode ? 'ROLL' : 'S') + '  DROP IN TO DESCEND', hx, hy - 34, '#d6b98a', 'center', 0.6 + 0.4 * Math.sin(time * 3));
  }

  /* ---- what is drawn over a Deep room: where you are, your wards, the upgrade choice, the end of a run */
  function drawDeepHUD(ctx) {
    const L7 = Math.ceil(7 * HS) + 3;
    if (RUN && (mode === 'play' || mode === 'pause')) {
      const base = DEEPROOMS.find(r => r.id === RUN.rooms[RUN.i]) || {};
      const hy = Math.round(44 / SC) + 14;
      ht(DP.STRATUM_NAMES[base.stratum || 0] + '   ' + (RUN.i + 1) + ' / ' + RUN.rooms.length, 8, hy, '#9fb8bc', 'left', 0.8);
      if (RUN.shields > 0) ht('WARD x' + RUN.shields, 8, hy + L7, '#d6b98a', 'left', 0.8);
      const ch = world.level.chest;
      if (ch && ch.near && ch.T < 0) ht((touchMode ? 'SEEK' : 'E') + '  OPEN', Math.round(ch.x - camX), Math.round(ch.y - camY) - 28, PAL.gold, 'center', 0.65 + 0.35 * Math.sin(gameTime * 4));
      if (deepMsgT < 2.5) { deepMsgT += frameDt; ht(deepMsgS, LW >> 1, Math.round(LH * 0.3), '#d6b98a', 'center', Math.min(1, (2.5 - deepMsgT) * 2)); }
      return;
    }
    ctx.fillStyle = 'rgba(4,6,10,' + Math.min(0.78, deepT * 1.4).toFixed(3) + ')'; ctx.fillRect(0, 0, LW, LH);
    const a = Math.min(1, deepT / 0.6), cx = LW >> 1;
    if (mode === 'deepPick') {
      ht('ROOM ' + (RUN.i + 1) + ' CLEARED', cx, Math.round(LH * 0.12), PAL.snow, 'center', a, 2);
      ht('TAKE ONE GIFT FOR THE WAY DOWN', cx, Math.round(LH * 0.12) + Math.ceil(14 * HS) + 6, '#9fb8bc', 'center', a);
      for (const [i, c] of pickCards().entries()) {
        const sel = i === deepSel;
        ctx.globalAlpha = a; ctx.fillStyle = sel ? 'rgba(185,168,123,0.18)' : 'rgba(22,30,38,0.9)'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = sel ? PAL.gold : '#33434c'; ctx.fillRect(c.x, c.y, c.w, 1); ctx.fillRect(c.x, c.y + c.h - 1, c.w, 1); ctx.fillRect(c.x, c.y, 1, c.h); ctx.fillRect(c.x + c.w - 1, c.y, 1, c.h);
        ctx.globalAlpha = 1;
        ht(c.u.name, c.x + c.w / 2, c.y + 6, sel ? PAL.gold : PAL.snow, 'center', a);
        wrap(c.u.text, (c.w - 8) / HS).forEach((l, k) => ht(l, c.x + c.w / 2, c.y + 8 + L7 * (k + 1.3), '#aab4c0', 'center', a));
      }
      const have = RUN.picks.map(id => DP.UPGRADES.find(u => u.id === id).name);
      if (have.length) wrap('SO FAR  ' + have.join('  -  '), (LW - 24) / HS).forEach((l, k) => ht(l, cx, Math.round(LH * 0.36) + 72 + k * L7, '#5d6474', 'center', a));
      ht(touchMode ? 'TAP A GIFT, TAP AGAIN TO TAKE IT' : 'ARROWS  CHOOSE     SPACE  TAKE IT', cx, LH - 14, PAL.gold, 'center', a * (0.6 + 0.4 * Math.sin(deepT * 4)));
    } else if (mode === 'deepOver') {
      ht(RUN && RUN.gaveUp ? 'YOU TURNED BACK' : S.why === 'void' ? 'THE DARK TOOK YOU' : 'THE LIGHT FOUND YOU', cx, Math.round(LH * 0.2), PAL.snow, 'center', a, 2);
      const base = RUN && DEEPROOMS.find(r => r.id === RUN.rooms[RUN.i]) || {};
      let y = Math.round(LH * 0.2) + Math.ceil(14 * HS) + 10;
      ht('ROOM ' + (RUN ? RUN.i + 1 : 0) + ' OF ' + DP.ROOMS_PER_RUN + '   ' + DP.STRATUM_NAMES[base.stratum || 0], cx, y, '#9fb8bc', 'center', a); y += L7 * 1.5;
      ht('DEEPEST  ROOM ' + P.deepBest + (deepRecord ? '   A NEW RECORD' : ''), cx, y, deepRecord ? '#d6b98a' : '#7f8a96', 'center', a); y += L7 * 1.5;
      ht('NO SEEKER WAKES THIS TIME', cx, y, '#5d6474', 'center', a);
      if (deepT > 1.5) ht(touchMode ? 'TAP  -  BACK TO THE CODEX' : 'SPACE  BACK TO THE CODEX', cx, LH - 16, PAL.gold, 'center', 0.6 + 0.4 * Math.sin(deepT * 4));
    } else if (mode === 'deepWin' && deepSpool) {
      // a spool of thread, for the weaver
      const y0 = Math.round(LH * 0.16), c = deepSpool;
      ht('A SPOOL OF THREAD', cx, y0, PAL.snow, 'center', a, 2);
      ctx.globalAlpha = a; R.drawSpool(ctx, cx, y0 + 62 + Math.round(Math.sin(deepT * 1.6) * 2), 3, c, deepT); ctx.globalAlpha = 1;
      let y = y0 + 80;
      ht(c.name, cx, y, c.glow || c.main, 'center', a, 2); y += L7 * 2;
      ht(c.wins + ' WINS IN THE DEEP', cx, y, '#7f9aa6', 'center', a); y += L7 * 1.4;
      ht('TAKE IT TO THE WEAVER', cx, y, '#c3cbd6', 'center', a * (0.75 + 0.25 * Math.sin(deepT * 3)));
      if (deepT > 1.5) ht(touchMode ? 'TAP  -  BACK TO THE CODEX' : 'SPACE  BACK TO THE CODEX', cx, LH - 16, PAL.gold, 'center', 0.6 + 0.4 * Math.sin(deepT * 4));
    } else if (mode === 'deepWin') {
      const y0 = Math.round(LH * 0.14);
      ht('A SEEKER WAKES IN THE DEEP', cx, y0, PAL.snow, 'center', a, 2);
      R.drawPortrait(ctx, cx, y0 + 50, 1, a, deepNew);
      let y = y0 + 82;
      ht('SEEKER NET  #' + deepNew + '   ' + gradeLine(deepNew), cx, y, DP.GRADE_COL[gradeOf(deepNew)], 'center', a); y += L7 * 1.4;
      for (const [src, words] of DP.abilities(R.seekerTraits(deepNew)).slice(0, 4)) { ht(words, cx, y, '#aab4c0', 'center', a); y += L7; }
      y += 4;
      ht('ADDED TO YOUR CODEX  -  ' + P.codex.length + ' OF ' + R.NETN, cx, y, '#7f9aa6', 'center', a);
      if (deepT > 1.5) ht(touchMode ? 'TAP  -  BACK TO THE CODEX' : 'SPACE  BACK TO THE CODEX', cx, LH - 16, PAL.gold, 'center', 0.6 + 0.4 * Math.sin(deepT * 4));
    }
  }

  /* ------------------------------------------------------------ camera */
  function camTarget() {
    if (window.__cam) return [window.__cam[0] - LW / 2, window.__cam[1] - LH / 2];   // (for mock-ups)
    const px = S.x + 2.5, py = S.y + S.h * 0.5;
    const look = Math.max(-1, Math.min(1, S.vx / 72)) * 26;
    let tx = px - LW / 2 + look;
    let ty = py - LH * 0.56 + (S.vy > 120 ? 22 : 0) + (S.wallDir ? -6 : 0);
    if (ARCH && world.level.archive) {
      // in the Codex the view leans toward the shell, more so while a seeker is awake, so its words are in view
      const c = world.level.archive.core, k = 0.45 + 0.35 * ARCH.iris, mx = LW * 0.36, my = LH * 0.34;
      tx = Math.max(px - LW / 2 - mx, Math.min(px - LW / 2 + mx, tx + (c[0] - LW / 2 - tx) * k));
      ty = Math.max(py - LH / 2 - my, Math.min(py - LH / 2 + my, ty + (c[1] + 30 - LH / 2 - ty) * k));
    }
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
      if (!RUN) writeTether();
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, sp = 10 + Math.random() * 40; R.spawn(st.cpX, st.cpY - 12, Math.cos(a) * sp, Math.sin(a) * sp - 25, 1 + Math.random(), i % 2 ? th.lamp[1] : th.lamp[2], 1, 20, true); }
    }
    if (ev & EV.SEEKER) {
      L.sfx('seeker'); flash = 0.6; seekerCardT = 0;
      if (!P.comp) { P.comp = true; codexInit(); }
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
    if (ev & EV.SHIELD) { L.sfx('hush'); flash = 0.8; shake = 1.2; if (RUN) RUN.shields = st.shields; deepMsg('THE WARD TAKES THE BURN'); }
    if (ev & EV.WIN && RUN) { deepRoomDone(); }
    else if (ev & EV.WIN && cur === CORE) {
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
    if (ARCH) { const e = !!(inp & IN.E); if (e && !ARCH.ePrev) archInteract(); ARCH.ePrev = e; inp &= ~IN.E; }
    if (RUN && world.level.chest && mode === 'play') chestStep(inp);
    const ch0 = RUN && world.level.chest;
    if (ch0 && (ch0.near || ch0.T >= 0)) inp &= ~IN.E;               // by the chest, E opens it (and does not call the eclipse)
    if (ch0 && ch0.T >= 0) inp = 0;                                  // and while it opens, you stand and watch
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
    if (ARCH && mode === 'play') {
      const A0 = world.level.archive;
      if (S.y > A0.hole[2] + 70) { ARCH = null; startDeep(); return; }
      if (S.x < A0.exit) { ARCH = null; toTown(NL); return; }
    }
    if (S.won && !RUN && !ARCH) { if (mode === 'play') { mode = 'win'; winT = 0; syncTouchUI(); } }
    // one life in The Deep: when the light finds you, the run is over
    if (RUN && S.dead && S.deadT > 70 && mode === 'play') deepOver(false);
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
        if (ARCH && mode === 'play') archFrame(dt);
        if (mode === 'win') winT += dt;
        cardT += dt; seekerCardT += dt;
        shake = Math.max(0, shake - dt * 6); flash = Math.max(0, flash - dt * 1.6);
        const fear = Math.min(1, Math.max(S.ex * 1.15, S.lit * 0.55));
        A.Live.update(S.dead ? 0.1 : fear, mode === 'win' ? 0.7 : 1);
        if (world.boss) A.Live.boss = { p: S.bP || 0, wake: !!S.bWake, die: S.bDie || 0, burst: !!S.bBurst, warn: S.bFlareWarn };
        if (RUN) { const k = (RUN.i + Math.max(0, Math.min(1, (S.x + 2.5) / (world.W * D.TS)))) / RUN.rooms.length; A.Live.deep = { k, seed: RUN.music }; A.Live.setMood(0.25 + 0.7 * k, RUN.keys[RUN.i % 8]); }
      } else if (mode === 'deepPick' || mode === 'deepOver' || mode === 'deepWin') {
        R.updateParticles(dt); deepT += dt; flash = Math.max(0, flash - dt * 1.6); shake = Math.max(0, shake - dt * 6);
        A.Live.update(0, 0.8);
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
      R.drawScene(ctx, { w: world, s: S, time: gameTime, dt: mode === 'pause' || mode === 'deepPick' ? 0 : dt, back: ARCH ? (c, x, y) => AR.drawBack(c, x, y, archSt()) : null, lift: ARCH ? (c, x, y, disc) => AR.lift(c, x, y, disc, archSt()) : null }, fx, fy, LW, LH);
      if (window.__overlay) window.__overlay(ctx, fx, fy, LW, LH, gameTime);   // (for mock-ups)
      halfText();
      if (ARCH) drawArchive(ctx, fx, fy);
      drawHUD(ctx);
      if (RUN || mode === 'deepOver' || mode === 'deepWin') drawDeepHUD(ctx);
    }
    gctx.imageSmoothingEnabled = false;
    gctx.fillStyle = '#000'; gctx.fillRect(0, 0, canvas.width, canvas.height);
    gctx.drawImage(off, 0, 0, LW, LH, Math.round(-ox), Math.round(-oy), LW * SC, LH * SC);
    flushHT();
    if (mode === 'title' || mode === 'town') {
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
      if (S_.deadT > 20 && !RUN && mode !== 'deepOver') { ctx.globalAlpha = Math.min(1, (S_.deadT - 20) / 20) * k; R.drawText(ctx, S_.why === 'void' ? 'THE DARK TOOK YOU' : 'THE LIGHT FOUND YOU', LW >> 1, (LH >> 1) - 4, PAL.muted, 1, 'center'); ctx.globalAlpha = 1; }
    }
    if (S_.ex > 0.04 && !S_.dead) {
      const px = Math.round(S_.x + 2.5 - camX), py = Math.round(S_.y - 7 - camY);
      drawBar(ctx, px - 8, py, 16, 2, Math.min(1, S_.ex), S_.ex > 0.7 ? '#e8e0d0' : '#a9c4d2');
    }
    if (world.boss && (mode === 'play' || mode === 'pause') && !window.__clean) {
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
    if (S_.cmp && mode !== 'win' && !window.__clean) {
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
    if (mode === 'play' && !window.__clean && !ARCH) {
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
        const cr = ['DWELLER', 'A GAME IN THE SEEKER UNIVERSE  -  OPEN ART, MUSIC AND LORE', 'THE GUARDIAN  -  PLANETARY GUARDIAN #255', 'YOUR COMPANION  -  SEEKER NET #' + R.seekerId, 'THANK YOU FOR DESCENDING', '', 'SOMETHING STIRS BEHIND THE GREAT DOOR'];
        cr.forEach((c, i) => R.drawText(ctx, c, LW >> 1, y0 + 96 + i * 12, i === 6 ? '#9fd3c7' : i ? '#a9b2c0' : PAL.gold, 1, 'center'));
        if (winT > 2.5) { ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(winT * 3)); R.drawText(ctx, touchMode ? 'TAP FOR THE TOWN' : 'ENTER  TOWN', LW >> 1, y0 + 186, PAL.gold, 1, 'center'); }
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
      deepRoom(id, tier) { startDeep(); RUN.rooms = [id, id]; RUN.tier = tier || 0; loadDeepRoom(0); },   // (for checking the rooms)
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
