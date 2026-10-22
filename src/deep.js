/* DWELLER — THE DEEP: the rules of the endless descent below the Codex.
 * What each of a seeker's traits does down there, the upgrades offered between rooms, how a run is laid out, how
 * hard it is (by the size of your Codex), and which seeker sleeps at the bottom. Abilities and upgrades only ever
 * act in The Deep; the story levels never see them. Everything here is plain data and small pure functions. */
(function (global) {
  'use strict';
  const STRATA = ['descent', 'mycelium', 'glass', 'foundry', 'ember', 'heart'];
  const STRATUM_NAMES = ['THE SHAFT', 'THE ROOTS', 'THE GEODE', 'THE WORKINGS', 'THE MAGMA', 'THE VEIN'];
  const ROOMS_PER_RUN = 8;

  /* ---- what a seeker's traits do. Each entry: the modifiers it brings and the words for it in the Codex.
     Multipliers multiply, shield and air add. (Defaults in Dweller.MOD0: burn, regen, run, jump, fall, hold, cd,
     reach, grace, shield, air.) */
  const BASE = {
    'Console': [{ cd: 0.85 }, 'RECHARGES QUICKLY'],
    'Framed': [{ hold: 1.15 }, 'HOLDS A LITTLE LONGER'],
    'Twin Tier': [{ hold: 1.3, cd: 1.2 }, 'LONG ECLIPSE, SLOW TO RECHARGE'],
    'Handheld': [{ hold: 0.8, cd: 0.65 }, 'SHORT ECLIPSE, VERY QUICK TO RECHARGE'],
    'Split Shell': [{ hold: 1.1, cd: 0.9 }, 'A LITTLE LONGER AND QUICKER'],
    'Radio': [{ reach: 1.2 }, 'REACHES FURTHER'],
    'Side Car': [{ hold: 1.2 }, 'HOLDS LONGER'],
    'Classic': [{ hold: 1.1, cd: 0.95 }, 'STEADY AND RELIABLE'],
    'Hood': [{ hold: 1.25, cd: 1.1 }, 'LONG ECLIPSE'],
    'Codex Header': [{ cd: 0.8 }, 'RECHARGES QUICKLY'],
    'Brackets': [{ hold: 0.9, cd: 0.75 }, 'QUICK, IF BRIEF'],
    'Side Lights': [{ cd: 0.9, reach: 1.1 }, 'QUICK AND FAR-SEEING'],
    'Tower': [{ hold: 1.5, cd: 1.35 }, 'THE LONGEST ECLIPSE, THE SLOWEST RECHARGE'],
    'Tape Deck': [{ hold: 1.15, cd: 0.9 }, 'LONGER AND QUICKER'],
    'Widescreen': [{ reach: 1.3 }, 'REACHES FAR'],
    'Porthole': [{ hold: 1.2, cd: 0.9 }, 'LONGER AND QUICKER'],
  };
  // eyes: how far it reaches for a light (four kinds of sight among the 32 eyes)
  const EYES_REACH = [[0.9, 'SEES NEAR'], [1.0, 'SEES WELL'], [1.12, 'SEES FAR'], [1.25, 'SEES VERY FAR']];
  const HEAD = {
    'Periscope': [{ grace: 1.8 }, 'A SAFE BREATH AT EACH ROOM\'S START'],
    'Work Lamp': [{ hold: 1.15 }, 'HOLDS THE DARK LONGER'],
    'Beacon': [{ regen: 1.3 }, 'YOU COOL QUICKLY IN THE DARK'],
    'Sonic Emitter': [{ cd: 0.85 }, 'RECHARGES QUICKLY'],
    'Mushrooms': [{ regen: 1.25, burn: 0.95 }, 'THE MYCELIUM SOOTHES YOU'],
    'Propeller': [{ fall: 0.7 }, 'YOU FALL SLOWLY'],
    'Dish': [{ reach: 1.25 }, 'REACHES FAR'],
    'Rabbit Ears': [{ grace: 2.2 }, 'A LONG SAFE BREATH AT EACH ROOM\'S START'],
    'Heat Sink': [{ burn: 0.88 }, 'LIGHT BURNS YOU MORE SLOWLY'],
    'Ice Crystals': [{ burn: 0.92, run: 1.04 }, 'COOL AND QUICK'],
  };
  const FLANK = {
    'Plug Cable': [{ cd: 0.85 }, 'RECHARGES QUICKLY'],
    'Wrench Arm': [{ hold: 1.15 }, 'HOLDS LONGER'],
    'Sword and Shield': [{ shield: 1 }, 'ONE FULL BURN IS TAKEN FROM YOU'],
    'Thruster Pods': [{ run: 1.08 }, 'YOU RUN FASTER'],
    'Solar Wings': [{ fall: 0.75 }, 'YOU GLIDE AS YOU FALL'],
    'Speakers': [{ regen: 1.2 }, 'YOU COOL QUICKLY IN THE DARK'],
    'Robot Arms': [{ jump: 1.06 }, 'YOU JUMP HIGHER'],
  };
  // the rare ones: only 356 of 2,222 seekers carry something on their back
  const BACK = {
    'Banner': [{ shield: 1, burn: 0.9 }, 'A WARD, AND LIGHT BURNS LESS'],
    'Sword': [{ shield: 1, run: 1.04 }, 'A WARD, AND QUICK FEET'],
    'Coolant Tank': [{ burn: 0.8 }, 'LIGHT BURNS YOU MUCH MORE SLOWLY'],
    'Exhaust Pipes': [{ air: 1 }, 'A JUMP IN MID-AIR'],
    'Signal Mast': [{ reach: 1.2, rare: 1 }, 'FINDS STRONG SEEKERS MORE OFTEN'],
    'Tesla Coil': [{ hold: 1.3, cd: 0.8 }, 'A LONG ECLIPSE THAT RECHARGES QUICKLY'],
    'Battery Pack': [{ cd: 0.6 }, 'RECHARGES VERY QUICKLY'],
  };

  /* ---- the upgrades offered between rooms (pick one of three); they last for the rest of the run */
  const UPGRADES = [
    { id: 'cloak', name: 'THICK CLOAK', text: 'LIGHT BURNS YOU MORE SLOWLY', m: { burn: 0.85 }, max: 3 },
    { id: 'breath', name: 'DEEP BREATH', text: 'YOU COOL FASTER IN THE DARK', m: { regen: 1.3 }, max: 3 },
    { id: 'feet', name: 'QUICK FEET', text: 'YOU RUN A LITTLE FASTER', m: { run: 1.06 }, max: 2 },
    { id: 'spring', name: 'SPRING', text: 'YOU JUMP A LITTLE HIGHER', m: { jump: 1.05 }, max: 2 },
    { id: 'wind', name: 'SECOND WIND', text: 'ONE MORE JUMP IN MID-AIR', m: { air: 1 }, max: 1 },
    { id: 'eclipse', name: 'LONG ECLIPSE', text: 'YOUR SEEKER HOLDS THE DARK LONGER', m: { hold: 1.3 }, max: 2 },
    { id: 'charge', name: 'QUICK CHARGE', text: 'YOUR SEEKER RECHARGES FASTER', m: { cd: 0.75 }, max: 2 },
    { id: 'sight', name: 'FAR SIGHT', text: 'YOUR SEEKER REACHES FURTHER', m: { reach: 1.3 }, max: 2 },
    { id: 'ward', name: 'WARD', text: 'THE NEXT FULL BURN IS TAKEN FROM YOU', m: { shield: 1 }, max: 3 },
    { id: 'still', name: 'STILLNESS', text: 'A SAFE BREATH AT THE START OF EVERY ROOM', m: { grace: 2.5 }, max: 1 },
    { id: 'feather', name: 'FEATHER', text: 'YOU FALL MORE SLOWLY', m: { fall: 0.8 }, max: 2 },
    // very rare: it turns up in about one offer in twenty, once a run
    { id: 'life', name: 'ANOTHER LIFE', text: 'ONE MORE SPARE LIFE FOR THIS RUN', m: {}, max: 1, rare: 0.05 },
  ];

  const ADD = { shield: 1, air: 1, rare: 1 };
  function merge(into, m) { for (const k in m) into[k] = ADD[k] ? (into[k] || 0) + m[k] : (into[k] === undefined ? 1 : into[k]) * m[k]; return into; }

  /* the abilities of a seeker (traits from DwellerRender.seekerTraits): a list of [source, words, modifiers] */
  function abilities(tr) {
    if (!tr) return [];
    const out = [];
    const b = BASE[tr.Base]; if (b) out.push(['BASE  ' + tr.Base.toUpperCase(), b[1], b[0]]);
    const ei = Math.abs(hashStr(tr.Eyes || '')) % 4, e = EYES_REACH[ei];
    out.push(['EYES  ' + (tr.Eyes || '').toUpperCase(), e[1], { reach: e[0] }]);
    const h = HEAD[tr.Head]; if (h) out.push(['HEAD  ' + tr.Head.toUpperCase(), h[1], h[0]]);
    const f = FLANK[tr.Flank]; if (f) out.push(['SIDE  ' + tr.Flank.toUpperCase(), f[1], f[0]]);
    const k = BACK[tr.Back]; if (k) out.push(['BACK  ' + tr.Back.toUpperCase(), k[1], k[0]]);
    return out;
  }
  function hashStr(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  /* the modifiers for a run: the seeker's abilities, then every upgrade picked so far */
  function modsFor(tr, picks) {
    const m = {};
    for (const a of abilities(tr)) merge(m, a[2]);
    for (const id of picks || []) { const u = UPGRADES.find(q => q.id === id); if (u) merge(m, u.m); }
    return m;
  }
  /* three different upgrades you can still take */
  function offer(rand, picks) {
    const count = (id) => (picks || []).filter(p => p === id).length;
    const pool = UPGRADES.filter(u => count(u.id) < u.max && (!u.rare || rand() < u.rare));
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    return out;
  }

  /* how good a seeker is in The Deep: every effect weighed by how much it keeps you alive on one life (points per
     doubling of a multiplier; a ward or a jump in mid-air counts almost as a life). Five tiers, S the best. */
  const WORTH = { burn: -14, regen: 7, run: 30, jump: 30, fall: -3, hold: 9, cd: -9, reach: 4, grace: 1.5 };
  const WORTH_ADD = { shield: 6, air: 6, rare: 1.5 };
  const GRADES = [['S', 13], ['A', 9], ['B', 6], ['C', 3.5], ['D', -1e9]];
  function score(tr) {
    if (!tr) return 0;
    const m = modsFor(tr, []); let s = 0;
    for (const k in WORTH) if (m[k] !== undefined) s += WORTH[k] * Math.log2(m[k]);
    for (const k in WORTH_ADD) s += (m[k] || 0) * WORTH_ADD[k];
    return s;
  }
  function grade(tr) { const s = score(tr); return GRADES.find(g => s >= g[1])[0]; }
  const GRADE_COL = { S: '#e8c37a', A: '#d6b98a', B: '#9fd3c7', C: '#8fa6b0', D: '#6f7a86' };

  /* how hard The Deep is: it follows the size of your Codex, and stops at a ceiling */
  function tierFor(n) { return n < 5 ? 0 : n < 10 ? 1 : n < 20 ? 2 : n < 35 ? 3 : 4; }
  const TIER_NAMES = ['GENTLE', 'DEEPENING', 'HARSH', 'CRUEL', 'THE CEILING'];

  /* a run: two strata, one after the other going down, four rooms from each. Never the same room twice, and the
     four from a stratum are the ones least alike, in the order that keeps neighbours apart: a stratum has only five
     kinds of stretch, so rooms must share some, but two rooms in a row never open with the same one and share as
     few as they can */
  const piecesOf = (r) => (r.sections || []).map(q => q.title).filter(t => t !== 'IN' && t !== 'DOWN');
  function bestFour(rand, list, n) {
    if (list.length <= n) return list.slice();
    const P = list.map(piecesOf);
    let best = null, bestS = Infinity;
    const idx = list.map((_, i) => i);
    const combos = []; (function go(a, k, cur) { if (cur.length === n) { combos.push(cur.slice()); return; } for (let i = a; i < idx.length; i++) { cur.push(i); go(i + 1, k, cur); cur.pop(); } })(0, n, []);
    const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
    for (const c of combos) for (const o of perms(c)) {
      let sc = rand() * 4;                                    // (a little chance in it, so runs still differ)
      for (let i = 1; i < o.length; i++) {
        const A = P[o[i - 1]], B = P[o[i]];
        sc += A.filter(x => B.includes(x)).length * 2;        // shared stretches between neighbours
        if (A[0] === B[0]) sc += 6;                           // the same opening
        if (A[A.length - 1] === B[0]) sc += 4;                // one room ends as the next begins
        for (let k = 0; k < Math.min(A.length, B.length); k++) if (A[k] === B[k]) sc += 1;
      }
      if (sc < bestS) { bestS = sc; best = o; }
    }
    return best.map(i => list[i]);
  }
  function planRun(rand, rooms) {
    const by = STRATA.map(st => rooms.filter(r => r.theme === st));
    const ok = STRATA.map((_, i) => i).filter(i => i + 1 < STRATA.length && by[i].length >= 4 && by[i + 1].length >= 4);
    const s0 = ok.length ? ok[Math.floor(rand() * ok.length)] : 0;
    const half = ROOMS_PER_RUN / 2;
    const out = bestFour(rand, by[s0], half).concat(bestFour(rand, by[Math.min(STRATA.length - 1, s0 + 1)], half)).map(r => r.id);
    return out.filter((id, i) => out.indexOf(id) === i);
  }

  /* the seeker sleeping at the bottom: one you have not found yet. Harder runs (and a Signal Mast) make a strong one
     likelier; strong means tier S or A in The Deep. strong: the ids of those seekers */
  function reward(rand, have, n, strong, tier, rareBoost) {
    const own = new Set(have);
    const p = Math.min(0.6, 0.05 + 0.04 * tier + 0.1 * (rareBoost || 0));
    const rareLeft = (strong || []).filter(id => !own.has(id));
    if (rareLeft.length && rand() < p) return rareLeft[Math.floor(rand() * rareLeft.length)];
    for (let k = 0; k < 10000; k++) { const id = 1 + Math.floor(rand() * n); if (!own.has(id)) return id; }
    return 1;
  }

  global.DwellerDeep = { STRATA, STRATUM_NAMES, ROOMS_PER_RUN, UPGRADES, abilities, modsFor, offer, tierFor, TIER_NAMES, planRun, reward, score, grade, GRADE_COL };
})(typeof globalThis !== 'undefined' ? globalThis : this);
