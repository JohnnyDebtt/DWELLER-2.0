/* DWELLER — procedural music and sound, all synthesised with Web Audio (no samples).
 *
 * Tuning: every pitch is 48 Hz x X / 2^N (the Seeker tuning). The palette is 1, 9/8, 19/16, 21/16, 3/2, 7/4.
 * Tempo: 90 BPM = 1.5 Hz; one step (a half beat) = 32 simulation ticks at 96 Hz.
 * Motifs of 5 and 7 steps run against each other and realign every 35 steps.
 * The same engine drives the live game (reacting to light and danger) and the offline render of the soundtrack.
 */
(function (global) {
  'use strict';
  const F0 = 48;
  const PALETTE = [1, 9 / 8, 19 / 16, 21 / 16, 3 / 2, 7 / 4];
  const BEAT = 60 / 90;
  const STEP = BEAT / 2;
  /* each level colours the same engine: a transposition (always a Seeker ratio, so the tuning holds),
     the register of the bells, and one voice of its own */
  const FLAVOURS = [
    // I the descent: ice and bells over a heartbeat (the original score, unchanged)
    { tr: 1, bellOct: 0, dens: 1, voice: '', score: 'descent' },
    // II mycelium: warm and damp; a kalimba walks in threes against the bar, the caps breathe every six beats
    { tr: 9 / 8, score: 'mycelium', gain: 1.3, pad: 'warm', drone: 0.55, wind: 0.6, windF: 300, echo: [0.75, 0.34, 1300] },
    // III glass garden: a high music box in sixteenths, glass chimes, almost no low end
    { tr: 19 / 16, score: 'glass', gain: 1.75, pad: 'glass', drone: 0.35, wind: 0.8, windF: 1400, echo: [0.5, 0.52, 4200] },
    // IV foundry: a machine ostinato, anvils on the beat, steam on the off-beat, a whistle now and then
    { tr: 3 / 4, score: 'foundry', pad: 'grind', drone: 1.0, wind: 0.5, windF: 700, echo: [0.25, 0.22, 2400] },
    // V ember deep: slow and heavy; great drums, a mournful reed, embers crackling in the dark
    { tr: 21 / 32, score: 'ember', gain: 0.8, pad: 'ember', drone: 1.25, wind: 0.45, windF: 220, echo: [1.5, 0.44, 900] },
    // VI the heart: the pulse is the rhythm; blood rushes after every beat, a choir hums, and the beat sometimes stumbles
    { tr: 7 / 8, score: 'heart', gain: 1.1, pad: 'choir', drone: 0.8, wind: 0.35, windF: 420, echo: [1.0, 0.3, 1500] },
    // VII the core: every level's voice returns, one with each sliver set, over the Guardian's turning drone
    { tr: 1, score: 'core', pad: 'glass', drone: 1.2, wind: 0.5, windF: 600, echo: [0.75, 0.4, 2000], gain: 1.0 },
    // THE DEEP: one score for the whole run, low and descending in nines and elevens; it gathers a layer for every
    // stretch of the way down and its heart beats faster the nearer you are to the bottom (Live.deep.k, 0..1)
    { tr: 9 / 16, score: 'deep', pad: 'choir', drone: 1.15, wind: 0.55, windF: 340, echo: [1.0, 0.46, 1600], gain: 1.1 },
  ];

  function hz(ratio, oct) { return F0 * ratio * Math.pow(2, oct); }
  function fold(f, lo, hi) { while (f < lo) f *= 2; while (f >= hi) f /= 2; return f; }
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function makeIR(ctx, seconds, decay, seed) {
    const rate = ctx.sampleRate, n = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, n, rate);
    const rnd = mulberry(seed || 7);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const env = Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1);
        lp += ((rnd() * 2 - 1) - lp) * (0.18 + 0.5 * (1 - t));   // darker as it decays
        d[i] = lp * env;
      }
    }
    return buf;
  }

  function noiseBuffer(ctx, seconds, seed) {
    const n = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), r = mulberry(seed || 3);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return buf;
  }

  class Engine {
    constructor(ctx, out, opts) {
      opts = opts || {};
      this.ctx = ctx; this.offline = !!opts.offline;
      this.rnd = mulberry(opts.seed || 1999);
      this.noise = noiseBuffer(ctx, 3, 5);
      const c = ctx;
      this.master = c.createGain(); this.master.gain.value = opts.volume === undefined ? 0.8 : opts.volume;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -20; this.comp.knee.value = 24; this.comp.ratio.value = 3.2; this.comp.attack.value = 0.012; this.comp.release.value = 0.35;
      this.shaper = c.createWaveShaper();
      const curve = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = (i / 1023.5 - 1); curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25); }
      this.shaper.curve = curve;
      this.master.connect(this.comp); this.comp.connect(this.shaper); this.shaper.connect(out);
      this.musicBus = c.createGain(); this.musicBus.gain.value = 1; this.musicBus.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
      // reverb + echo
      this.rev = c.createConvolver(); this.rev.buffer = makeIR(c, 4.2, 2.4, 11);
      this.revSend = c.createGain(); this.revSend.gain.value = 1; this.revOut = c.createGain(); this.revOut.gain.value = 0.62;
      this.revSend.connect(this.rev); this.rev.connect(this.revOut); this.revOut.connect(this.master);
      this.echo = c.createDelay(2); this.echo.delayTime.value = BEAT * 0.75;
      this.echoFb = c.createGain(); this.echoFb.gain.value = 0.42; this.echoLP = c.createBiquadFilter(); this.echoLP.type = 'lowpass'; this.echoLP.frequency.value = 1800;
      this.echo.connect(this.echoLP); this.echoLP.connect(this.echoFb); this.echoFb.connect(this.echo); this.echoLP.connect(this.revSend);
      this.echoOut = c.createGain(); this.echoOut.gain.value = 0.5; this.echoLP.connect(this.echoOut); this.echoOut.connect(this.musicBus);
      this.energy = 0.2; this.fear = 0; this.rootIdx = 0; this.seedBase = 1; this.fl = FLAVOURS[0];
      this.buildDrone(); this.buildWind(); this.buildFear();
      this.pad = null; this.padTime = -99;
    }

    osc(type, f, dest, g) {
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const gn = this.ctx.createGain(); gn.gain.value = g === undefined ? 1 : g;
      o.connect(gn); gn.connect(dest); o.start(); return { o, g: gn };
    }

    buildDrone() {
      const c = this.ctx;
      this.droneGain = c.createGain(); this.droneGain.gain.value = 0.0; this.droneGain.connect(this.musicBus);
      const send = c.createGain(); send.gain.value = 0.3; this.droneGain.connect(send); send.connect(this.revSend);
      this.osc('sine', F0, this.droneGain, 0.55);                       // 48 Hz, the fundamental
      this.osc('sine', F0 * 2, this.droneGain, 0.28);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.8; lp.connect(this.droneGain);
      this.osc('sawtooth', F0 * 2, lp, 0.20);                           // 96 Hz growl
      this.osc('triangle', F0 * 3, lp, 0.14);                           // 144 Hz (3/2)
      this.osc('sawtooth', F0 * 3, lp, 0.05);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.043; const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      this.droneLP = lp;
    }

    buildWind() {
      const c = this.ctx;
      this.windGain = c.createGain(); this.windGain.gain.value = 0; this.windGain.connect(this.musicBus);
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.4; this.windBP = bp;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      s.connect(bp); bp.connect(this.windGain); s.start(0, 0);
      const send = c.createGain(); send.gain.value = 0.5; this.windGain.connect(send); send.connect(this.revSend);
    }

    buildFear() {
      const c = this.ctx;
      this.fearGain = c.createGain(); this.fearGain.gain.value = 0; this.fearGain.connect(this.musicBus);
      const send = c.createGain(); send.gain.value = 0.35; this.fearGain.connect(send); send.connect(this.revSend);
      // 19 and 21 harmonics of 48 Hz beat against each other at 96 Hz: tension
      this.osc('sine', F0 * 19, this.fearGain, 0.16); this.osc('sine', F0 * 21, this.fearGain, 0.16);
      this.osc('sine', F0 * 13, this.fearGain, 0.10); this.osc('triangle', F0 * 7, this.fearGain, 0.12);
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
      const ng = c.createGain(); ng.gain.value = 0.10; s.connect(hp); hp.connect(ng); ng.connect(this.fearGain); s.start(0, 1.1);
    }

    /* the room each level plays in: echo time, feedback and colour, and where the wind whistles */
    applyRoom(t) {
      const fl = this.fl, ec = fl.echo || [0.75, 0.42, 1800];
      this.echo.delayTime.setTargetAtTime(BEAT * ec[0], t, 0.3);
      this.echoFb.gain.setTargetAtTime(ec[1], t, 0.3);
      this.echoLP.frequency.setTargetAtTime(ec[2], t, 0.3);
      if (this.windBP) this.windBP.frequency.setTargetAtTime(fl.windF || 520, t, 0.5);
      this.musicBus.gain.setTargetAtTime(fl.gain || 1, t, 0.4);
    }

    /* chord pad: swap voices when the root changes */
    setRoot(t, idx) {
      if (this.pad && this.rootIdx === idx) return;
      this.rootIdx = idx;
      const c = this.ctx;
      if (this.pad) {
        const old = this.pad;
        old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + 5);
        old.stop = t + 5.2;
        for (const o of old.oscs) { try { o.stop(t + 5.3); } catch (e) { } }
      }
      const g = c.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 4.5);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5;
      g.connect(lp); const out = c.createGain(); out.gain.value = 0.0; lp.connect(out); out.connect(this.musicBus);
      const send = c.createGain(); send.gain.value = 0.55; out.connect(send); send.connect(this.revSend);
      const r = PALETTE[idx] * this.fl.tr, kind = this.fl.pad || '';
      let notes = [fold(F0 * r * 4, 150, 300), fold(F0 * r * 6, 190, 420), fold(F0 * r * 7, 230, 500), fold(F0 * r * 19 / 16 * 8, 300, 640)];
      let voices = [['sawtooth', 0.07, 1], ['triangle', 0.12, 1], ['sine', 0.08, 2]];
      let dest = g;
      if (kind === 'warm') { notes = [fold(F0 * r * 2, 90, 180), fold(F0 * r * 3, 130, 260), fold(F0 * r * 21 / 16 * 4, 160, 330)]; voices = [['triangle', 0.16, 1], ['sine', 0.12, 2]]; lp.frequency.value = 520; }
      if (kind === 'glass') {
        notes = [fold(F0 * r * 8, 600, 1200), fold(F0 * r * 12, 700, 1400), fold(F0 * r * 14, 800, 1600), fold(F0 * r * 9, 900, 1800)]; voices = [['sine', 0.05, 1], ['sine', 0.02, 2]];
        const trem = c.createGain(); trem.gain.value = 0.7; const tl = c.createOscillator(); tl.frequency.value = 0.75; const tg = c.createGain(); tg.gain.value = 0.3;
        tl.connect(tg); tg.connect(trem.gain); tl.start(t); trem.connect(g); dest = trem; lp.frequency.value = 3000;
      }
      if (kind === 'grind') { notes = [fold(F0 * r * 2, 60, 120), fold(F0 * r * 3, 90, 180), fold(F0 * r * 4, 120, 240)]; voices = [['sawtooth', 0.10, 1], ['square', 0.03, 1]]; lp.frequency.value = 380; lp.Q.value = 4; }
      if (kind === 'ember') { notes = [fold(F0 * r, 36, 72), fold(F0 * r * 3 / 2, 54, 108), fold(F0 * r * 19 / 16 * 2, 70, 140)]; voices = [['sawtooth', 0.09, 1], ['sine', 0.2, 1]]; lp.frequency.value = 300; }
      if (kind === 'choir') {
        // an 'ah': sawtooth voices through two formant filters
        notes = [fold(F0 * r * 4, 150, 300), fold(F0 * r * 6, 190, 400), fold(F0 * r * 7 / 4 * 4, 230, 460)]; voices = [['sawtooth', 0.13, 1]];
        const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 760; f1.Q.value = 5;
        const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 7;
        const mix = c.createGain(); mix.gain.value = 2.2; f1.connect(mix); f2.connect(mix); mix.connect(g);
        dest = c.createGain(); dest.connect(f1); dest.connect(f2); lp.frequency.value = 2200;
      }
      const oscs = [];
      notes.forEach((f, i) => {
        for (const [type, gain, mul] of voices) {
          const o = c.createOscillator(); o.type = type; o.frequency.value = f * mul;
          if (kind === 'choir') { const v = c.createOscillator(); v.frequency.value = 4.6 + i * 0.4; const vg2 = c.createGain(); vg2.gain.value = f * 0.004; v.connect(vg2); vg2.connect(o.frequency); v.start(t); oscs.push(v); }
          const vg = c.createGain(); vg.gain.value = gain; o.connect(vg); vg.connect(dest); o.start(t);
          oscs.push(o);
        }
      });
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + 0.02 * idx; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); oscs.push(lfo);
      this.pad = { g, lp, out, oscs };
    }

    /* continuous parameters; call often (cheap) */
    setParams(t, p) {
      const e = p.energy === undefined ? this.energy : p.energy, f = p.fear || 0;
      this.energy = e; this.fear = f;
      const tc = 0.6;
      const d = p.duck === undefined ? 1 : p.duck;
      const fl = this.fl || {};
      this.droneGain.gain.setTargetAtTime((0.32 + 0.18 * e) * d * (fl.drone || 1), t, tc);
      this.windGain.gain.setTargetAtTime((0.085 + 0.05 * (1 - e)) * d * (fl.wind || 1), t, tc);
      this.fearGain.gain.setTargetAtTime(0.14 * f * f * d, t, 0.25);
      if (this.pad) { this.pad.out.gain.setTargetAtTime((0.20 + 0.30 * e) * d, t, tc); this.pad.lp.frequency.setTargetAtTime(520 + 1100 * e, t, 1.5); }
      this.droneLP.frequency.setTargetAtTime(210 + 340 * e + 200 * f, t, 1.2);
    }

    env(g, t, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    bell(t, f, vel, dur) {
      const c = this.ctx;
      const g = c.createGain(); this.env(g, t, 0.006, 0.20 * vel, dur || 2.2);
      const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
      const g2 = c.createGain(); g2.gain.value = 0.35;
      const o3 = c.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * 3; const g3 = c.createGain(); g3.gain.value = 0.10;
      o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
      g.connect(this.musicBus); const s1 = c.createGain(); s1.gain.value = 0.6; g.connect(s1); s1.connect(this.revSend);
      const s2 = c.createGain(); s2.gain.value = 0.5; g.connect(s2); s2.connect(this.echo);
      const end = t + (dur || 2.2) + 0.1;
      for (const o of [o1, o2, o3]) { o.start(t); o.stop(end); }
    }

    thump(t, f0, vel, len) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0 * 2.2, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.09);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (len || 0.42));
      o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + (len || 0.42) + 0.05);
      const s = c.createGain(); s.gain.value = 0.25; g.connect(s); s.connect(this.revSend);
    }

    pluckBass(t, f, vel, dur) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
      lp.frequency.setValueAtTime(900 + 700 * this.energy, t); lp.frequency.exponentialRampToValueAtTime(130, t + dur);
      const g = c.createGain(); this.env(g, t, 0.01, 0.22 * vel, dur);
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = f; const sg = c.createGain(); sg.gain.value = 0.7;
      o.connect(lp); lp.connect(g); sub.connect(sg); sg.connect(g); g.connect(this.musicBus);
      o.start(t); sub.start(t); o.stop(t + dur + 0.1); sub.stop(t + dur + 0.1);
    }

    tick(t, vel, f) {
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f || 2400; bp.Q.value = 6;
      const g = c.createGain(); this.env(g, t, 0.002, 0.08 * vel, 0.07);
      s.connect(bp); bp.connect(g); g.connect(this.musicBus);
      const sd = c.createGain(); sd.gain.value = 0.4; g.connect(sd); sd.connect(this.revSend);
      s.start(t, this.rnd() * 2); s.stop(t + 0.12);
    }

    /* ----------------------------------------------------------- the voices the other levels add */
    voice(t, f, vel, dur, partials, dest) {        // a struck tone: [mul, gain, decay] partials
      const c = this.ctx, g = c.createGain(); g.gain.value = vel; g.connect(dest || this.musicBus);
      const end = t + dur + 0.1;
      for (const [mul, gn, dc] of partials) {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
        const pg = c.createGain(); this.env(pg, t, 0.003, gn, dur * dc);
        o.connect(pg); pg.connect(g); o.start(t); o.stop(end);
      }
      return g;
    }
    kalimba(t, f, vel) {
      const g = this.voice(t, f, 0.22 * vel, 1.1, [[1, 1, 1], [4.0, 0.35, 0.18], [6.27, 0.12, 0.1]]);
      const s = this.ctx.createGain(); s.gain.value = 0.45; g.connect(s); s.connect(this.echo);
      const r = this.ctx.createGain(); r.gain.value = 0.35; g.connect(r); r.connect(this.revSend);
    }
    marimba(t, f, vel, dur) { const g = this.voice(t, f, 0.3 * vel, dur || 1.4, [[1, 1, 1], [4, 0.25, 0.12], [9.9, 0.05, 0.05]]); const r = this.ctx.createGain(); r.gain.value = 0.3; g.connect(r); r.connect(this.revSend); }
    glassPing(t, f, vel, dur) {
      const g = this.voice(t, f, 0.12 * vel, dur || 1.6, [[1, 1, 1], [2, 0.18, 0.6], [5.2, 0.06, 0.2]]);
      const s = this.ctx.createGain(); s.gain.value = 0.55; g.connect(s); s.connect(this.echo);
      const r = this.ctx.createGain(); r.gain.value = 0.8; g.connect(r); r.connect(this.revSend);
    }
    anvil(t, f, vel) {
      const g = this.voice(t, f, 0.16 * vel, 1.3, [[1, 1, 1], [2.76, 0.6, 0.6], [5.4, 0.4, 0.3], [8.93, 0.25, 0.15]]);
      const r = this.ctx.createGain(); r.gain.value = 0.4; g.connect(r); r.connect(this.revSend);
      this.tick(t, 1.4 * vel, 4200);
    }
    noiseHit(t, dur, type, f0, f1, vel, q, attack) {   // a noise gesture on the music bus
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = type; bp.Q.value = q || 1;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + (attack || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(this.musicBus);
      const sd = c.createGain(); sd.gain.value = 0.3; g.connect(sd); sd.connect(this.revSend);
      s.start(t, this.rnd() * 2); s.stop(t + dur + 0.05);
    }
    machine(t, f, vel, dur) {                       // a gated square for the foundry ostinato
      const c = this.ctx, o = c.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(380 + 900 * this.energy, t); lp.frequency.exponentialRampToValueAtTime(110, t + dur);
      const g = c.createGain(); this.env(g, t, 0.004, 0.12 * vel, dur);
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2; const sg = c.createGain(); sg.gain.value = 0.9;
      o.connect(lp); lp.connect(g); sub.connect(sg); sg.connect(g); g.connect(this.musicBus);
      o.start(t); sub.start(t); o.stop(t + dur + 0.05); sub.stop(t + dur + 0.05);
    }
    reed(t, f, vel, dur, vib) {                    // a slow, breathy lead: duduk, whistle or hum
      const c = this.ctx, g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.6, dur * 0.3));
      g.gain.setValueAtTime(vel, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f * 3.2; lp.Q.value = 1.2;
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
      const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f; const g2 = c.createGain(); g2.gain.value = 1.6;
      const v = c.createOscillator(); v.frequency.value = vib || 5; const vg = c.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.5);
      v.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(this.musicBus);
      const s = c.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.revSend);
      const e2 = c.createGain(); e2.gain.value = 0.25; g.connect(e2); e2.connect(this.echo);
      for (const o of [o1, o2, v]) { o.start(t); o.stop(t + dur + 0.1); }
    }
    taiko(t, vel, f) {
      this.thump(t, f || 36, vel, 1.3);
      this.noiseHit(t, 0.5, 'lowpass', 420, 70, 0.22 * vel, 0.8, 0.004);
    }

    /* one musical step (half a beat). n is the global step number. Each level has its own score. */
    step(t, n, p) {
      const sc = this.fl.score;
      if (sc && sc !== 'descent') return this['score_' + sc](t, n, p.energy === undefined ? this.energy : p.energy);
      const e = p.energy === undefined ? this.energy : p.energy;
      const idx = this.rootIdx, root = PALETTE[idx] * this.fl.tr, fl = this.fl;
      const r = this.rnd;
      const bar = Math.floor(n / 8), s8 = n % 8;
      // heartbeat: lub-dub every two beats
      if (n % 4 === 0) {
        const v = 0.30 + 0.45 * e;
        this.thump(t, 48, v, 0.5); this.thump(t + 0.20, 48, v * 0.55, 0.32);
      }
      // bass motif, 5 steps
      if (e > 0.28) {
        const pat = [0, 0, 4, 2, 5], k = n % 5;
        if (k === 0 || (e > 0.55 && (k === 2 || k === 3))) {
          const ratio = PALETTE[pat[k]] * root;
          this.pluckBass(t, fold(F0 * ratio * 2, 48, 130), 0.5 + 0.5 * e, STEP * 1.8);
        }
      }
      // bells, 7-step motif; density follows energy
      const motif = [1, 0, 1, 1, 0, 1, 0], k7 = n % 7;
      const dens = (0.30 + 0.45 * (1 - e * 0.55)) * fl.dens;
      if (motif[k7] && r() < dens) {
        const choice = [0, 2, 4, 5, 1, 4, 2][Math.floor(r() * 7)];
        const ratio = PALETTE[choice] * root;
        const oct = 3 + Math.floor(r() * 3);
        const lo = 380 * Math.pow(2, fl.bellOct), hi = 2000 * Math.pow(2, fl.bellOct);
        this.bell(t, fold(F0 * ratio * Math.pow(2, oct), lo, hi), 0.45 + 0.5 * r() * (1 - 0.3 * e), fl.voice === 'glass' ? 3.4 : 2.4);
      }
      // the level's own voice
      if (fl.voice === 'wood' && (n % 5 === 0 || (n % 5 === 3 && r() < 0.5))) this.tick(t, 0.9, 380 + 160 * (n % 3));
      if (fl.voice === 'glass' && n % 7 === 3) this.bell(t, fold(F0 * root * 21 * 4, 1800, 3600), 0.18, 1.6);
      if (fl.voice === 'anvil' && n % 2 === 0) {
        if (n % 8 === 0) { this.sfxTone(t, F0 * 13 * root, F0 * 13 * root * 0.99, 0.5, 0.05 + 0.05 * e, 'triangle'); this.tick(t, 1.2, 3200); }
        else if (e > 0.35 && n % 4 === 2) this.tick(t, 0.7, 2600);
      }
      if (fl.voice === 'rumble' && n % 8 === 0) this.sfxNoise(t, BEAT * 3, 'lowpass', 160, 60, 0.10 + 0.08 * e, 0.7);
      if (fl.voice === 'heart' && n % 4 === 2) { const v = 0.22 + 0.3 * e; this.thump(t, 36, v, 0.4); this.thump(t + 0.18, 36, v * 0.5, 0.3); }
      // low drums when it gets serious
      if (e > 0.6) {
        if ([0, 3, 6].includes(s8)) this.thump(t, 72, 0.35 * e, 0.28);
        if ([2, 5, 7].includes(s8) && r() < 0.6) this.tick(t, 0.5 + 0.5 * e, 1800 + 1800 * r());
      }
      // drips in the dark
      if (r() < 0.05) this.bell(t + r() * STEP, fold(F0 * PALETTE[Math.floor(r() * 6)] * 32, 1500, 3200), 0.12, 0.9);
    }

    pick(i) { return PALETTE[((i % 6) + 6) % 6] * PALETTE[this.rootIdx] * this.fl.tr; }

    /* II THE MYCELIUM: in threes against the bar, soft and damp */
    score_mycelium(t, n, e) {
      const r = this.rnd, bar = Math.floor(n / 8);
      // the caps breathe: a slow swell every six beats
      if (n % 12 === 0) this.noiseHit(t, BEAT * 5, 'lowpass', 260, 900, 0.05 + 0.05 * e, 0.9, BEAT * 2.5);
      // kalimba walking in threes (6 steps) over the 8-step bar
      const walk = [0, 4, 2, 5, 4, 2], k = n % 6;
      if (n % 2 === 0 || e > 0.35) {
        const up = (Math.floor(n / 24) % 2) ? 1 : 0;
        this.kalimba(t, fold(F0 * this.pick(walk[k] + up) * 8, 260, 620), (k === 0 ? 0.9 : 0.55) * (0.6 + 0.4 * e));
      }
      // soft low marimba: the root, and the fifth on the sixth step
      if (n % 8 === 0) this.marimba(t, fold(F0 * this.pick(0) * 2, 70, 140), 0.8, 2.2);
      if (n % 8 === 5 && e > 0.25) this.marimba(t, fold(F0 * this.pick(4) * 2, 90, 180), 0.5, 1.4);
      // muffled knocks instead of a heartbeat
      if (n % 8 === 0) this.thump(t, 40, 0.18 + 0.2 * e, 0.3);
      if (n % 5 === 3) this.tick(t, 0.6, 340 + 140 * (bar % 3));
      // spores popping
      if (r() < 0.10) this.tick(t + r() * STEP, 0.35, 2600 + 1600 * r());
      if (e > 0.6 && n % 2 === 1) this.noiseHit(t, 0.09, 'highpass', 5200, 4000, 0.025 * e, 0.8, 0.004);
    }

    /* III THE GLASS GARDEN: a high music box in sixteenths, chimes, almost nothing low */
    score_glass(t, n, e) {
      const r = this.rnd;
      const seq = [0, 2, 4, 5, 4, 2, 1], hs = STEP / 2;
      for (let h = 0; h < 2; h++) {
        const i = n * 2 + h, k = i % 7;
        if (h === 1 && e < 0.3 && i % 4 !== 1) continue;
        const oct = Math.floor(i / 14) % 3;
        this.glassPing(t + h * hs, fold(F0 * this.pick(seq[k]) * 16 * Math.pow(2, oct === 2 ? 1 : 0), 700, 2300), (k === 0 ? 0.9 : 0.5) * (0.55 + 0.45 * e), 1.3);
      }
      // a strummed chord of glass every two bars
      if (n % 16 === 0) [0, 4, 5, 2].forEach((d, j) => this.glassPing(t + j * 0.07, fold(F0 * this.pick(d) * 32, 1400, 3400), 0.7, 3.4));
      // a faint sub, so the garden has a floor
      if (n % 16 === 0) this.marimba(t, fold(F0 * this.pick(0), 40, 80), 0.45, 3.0);
      // tinks on five, against the seven of the box
      if (n % 5 === 0) this.tick(t, 0.45, 6200);
      if (e > 0.55 && n % 5 === 2) this.tick(t + hs, 0.4, 4800);
      if (r() < 0.06) this.glassPing(t + r() * STEP, fold(F0 * this.pick(Math.floor(r() * 6)) * 64, 2600, 4800), 0.3, 0.8);
    }

    /* IV THE FOUNDRY: the machine keeps time */
    score_foundry(t, n, e) {
      const r = this.rnd, s8 = n % 8;
      // the machine ostinato in eighths (quarters while it is quiet)
      const pat = [0, 0, 4, 0, 0, 4, 5, 4];
      if (e > 0.3 || n % 2 === 0) this.machine(t, fold(F0 * this.pick(pat[s8]) * 2, 50, 110), (s8 === 0 ? 1 : 0.65) * (0.55 + 0.45 * e), STEP * 0.7);
      // the hammer on every beat, the anvil on one and three
      if (n % 2 === 0) this.thump(t, 58, 0.28 + 0.35 * e, 0.22);
      if (s8 === 0) this.anvil(t, fold(F0 * this.pick(0) * 13, 500, 1000), 0.9);
      if (s8 === 4) this.anvil(t, fold(F0 * this.pick(4) * 13, 500, 1000), 0.55);
      // a clank on two and four
      if (s8 === 2 || s8 === 6) this.noiseHit(t, 0.14, 'bandpass', 1700, 900, 0.10 + 0.08 * e, 2.2, 0.003);
      // steam on the off-beat of three
      if (s8 === 5) this.noiseHit(t, 0.55, 'highpass', 2600, 5200, 0.05 + 0.04 * e, 0.7, 0.05);
      // chains in sixteenths when the shift is busy
      if (e > 0.5) this.tick(t + STEP / 2, 0.35 + 0.3 * r(), 3000 + 1200 * r());
      // the shift whistle, now and then
      if (n % 32 === 24) this.reed(t, fold(F0 * this.pick(5) * 8, 260, 520), 0.05 + 0.03 * e, BEAT * 2.5, 6.5);
    }

    /* V EMBER DEEP: slow and heavy under a buried sun */
    score_ember(t, n, e) {
      const r = this.rnd;
      // the great drum on one, an answer late in the bar
      if (n % 8 === 0) this.taiko(t, 0.55 + 0.3 * e, 34);
      if (n % 8 === 5 && e > 0.3) this.taiko(t, 0.28 + 0.2 * e, 42);
      if (n % 32 === 30 && e > 0.5) { this.taiko(t, 0.3, 46); this.taiko(t + STEP / 2, 0.36, 42); }
      // the ground groans
      if (n % 16 === 0) this.noiseHit(t, BEAT * 4, 'lowpass', 140, 50, 0.09 + 0.06 * e, 0.7, 0.4);
      if (n % 16 === 0) this.pluckBass(t, fold(F0 * this.pick(0), 30, 62), 0.9, BEAT * 3);
      // a mournful reed, long notes falling through the low palette
      const phrase = [[0, 0, 4], [2, 3, 1], [4, 2, 0], [3, 1, 0]][Math.floor(n / 32) % 4];
      if (n % 32 === 0) this.reed(t, fold(F0 * this.pick(phrase[0]) * 4, 150, 300), 0.07 + 0.03 * e, BEAT * 5, 4.2);
      if (n % 32 === 12) this.reed(t, fold(F0 * this.pick(phrase[1]) * 4, 150, 300), 0.06 + 0.03 * e, BEAT * 3, 4.2);
      if (n % 32 === 20) this.reed(t, fold(F0 * this.pick(phrase[2]) * 4, 130, 260), 0.06 + 0.03 * e, BEAT * 5, 4.2);
      // embers crackling
      const c = r() < 0.4 ? 1 + Math.floor(r() * 3) : 0;
      for (let i = 0; i < c; i++) this.noiseHit(t + r() * STEP, 0.02 + 0.03 * r(), 'highpass', 2500 + 3000 * r(), 1500, 0.02 + 0.03 * r(), 0.7, 0.001);
      // a low gong, rarely
      if (n % 64 === 48) this.bell(t, fold(F0 * this.pick(4) * 4, 110, 220), 0.9, 6);
    }

    /* VI THE HEART: the pulse is the rhythm, and it stumbles */
    score_heart(t, n, e) {
      const r = this.rnd, beat = n % 4 === 0;
      const stumble = n % 64 === 60;                // arrhythmia: once in a long while the beat comes early
      if (beat || stumble) {
        const v = 0.42 + 0.4 * e, tt = stumble ? t - STEP * 0.3 : t;
        this.thump(tt, 46, v, 0.5); this.thump(tt + 0.19, 46, v * 0.6, 0.34);
        // blood rushing after the beat
        this.noiseHit(tt + 0.08, BEAT * 1.4, 'lowpass', 180, 520, 0.05 + 0.05 * e, 1.2, BEAT * 0.5);
      }
      // a deep pulse of the root after the beat
      if (n % 8 === 1) this.pluckBass(t, fold(F0 * this.pick(0) * 2, 44, 96), 0.7, STEP * 3);
      if (n % 8 === 5 && e > 0.4) this.pluckBass(t, fold(F0 * this.pick(4) * 2, 60, 130), 0.5, STEP * 2);
      // a hummed line, sparse, in sevens
      const hum = [5, 4, 0, 1, 4, 0, 2], k = n % 14;
      if (k % 2 === 0 && [0, 4, 6].includes(k / 2) && r() < 0.6 + 0.3 * e) this.reed(t, fold(F0 * this.pick(hum[k / 2]) * 8, 300, 640), 0.035 + 0.02 * e, BEAT * 2.2, 5.5);
      // nerves: the 19th and 21st harmonics, together, very quietly
      if (n % 32 === 16) { this.bell(t, fold(F0 * 19 * this.fl.tr, 900, 1900), 0.25, 3); this.bell(t + 0.05, fold(F0 * 21 * this.fl.tr, 900, 1900), 0.25, 3); }
      if (e > 0.6 && n % 2 === 1) this.tick(t, 0.35, 1400 + 600 * r());
    }

    /* VII THE CORE: the descent's bells and heart, and each sliver brings its level's voice back in */
    score_core(t, n, e) {
      const b = Live.boss || { p: 0 }, P = b.wake ? b.p : -1, r = this.rnd, s8 = n % 8;
      if (b.burst) {                                   // after it shatters: only the fall, and a long chord
        if (n % 16 === 0) [0, 4, 5].forEach((d, j) => this.bell(t + j * 0.05, fold(F0 * this.pick(d) * 8, 300, 900), 0.6, 6));
        if (n % 4 === 0) this.noiseHit(t, BEAT * 2, 'highpass', 900, 5200, 0.05, 0.7, BEAT);
        return;
      }
      if (b.die) {                                     // the heart stumbles
        if (r() < 0.55) { this.thump(t + r() * STEP * 0.5, 46, 0.7, 0.4); this.thump(t + 0.12 + r() * 0.1, 46, 0.45, 0.3); }
        this.noiseHit(t, STEP, 'bandpass', 3000 + 2000 * r(), 800, 0.06, 2, 0.002);
        return;
      }
      // always: the heartbeat of the descent, slow while it sleeps
      if (n % (P < 0 ? 8 : 4) === 0) { const v = 0.3 + 0.08 * Math.max(0, P); this.thump(t, 48, v, 0.5); this.thump(t + 0.2, 48, v * 0.55, 0.32); }
      if (P < 0) { if (r() < 0.06) this.bell(t, fold(F0 * this.pick(Math.floor(r() * 6)) * 32, 900, 2400), 0.3, 3); return; }
      // I: the descent's bells
      if ([1, 0, 1, 1, 0, 1, 0][n % 7] && r() < 0.5) this.bell(t, fold(F0 * this.pick([0, 2, 4, 5][Math.floor(r() * 4)]) * 16, 380, 2000), 0.5, 2.4);
      // II: the kalimba in threes
      if (P >= 1 && n % 2 === 0) this.kalimba(t, fold(F0 * this.pick([0, 4, 2, 5, 4, 2][n % 6]) * 8, 260, 620), 0.5);
      if (P >= 1 && n % 12 === 0) this.noiseHit(t, BEAT * 5, 'lowpass', 260, 900, 0.06, 0.9, BEAT * 2.5);
      // III: the music box on the off-steps
      if (P >= 2 && n % 2 === 1) this.glassPing(t, fold(F0 * this.pick([0, 2, 4, 5, 4, 2, 1][n % 7]) * 16, 700, 2300), 0.5, 1.2);
      // IV: the machine and the anvil
      if (P >= 3) { this.machine(t, fold(F0 * this.pick([0, 0, 4, 0, 0, 4, 5, 4][s8]) * 2, 50, 110), s8 === 0 ? 0.9 : 0.55, STEP * 0.7); if (s8 === 0) this.anvil(t, fold(F0 * this.pick(0) * 13, 500, 1000), 0.7); }
      // V: the great drum, and the flare's warning swell
      if (P >= 4) { if (s8 === 0) this.taiko(t, 0.6, 34); if (s8 === 5) this.taiko(t, 0.3, 42); }
      if (b.warn >= 0 && b.warn < 32 && n % 2 === 0) this.noiseHit(t, BEAT * 1.5, 'bandpass', 400, 3200, 0.08, 1.2, BEAT);
      // V/VI: the reed over the top
      if (P >= 5 && n % 16 === 0) this.reed(t, fold(F0 * this.pick([0, 4, 2, 5][Math.floor(n / 16) % 4]) * 4, 150, 300), 0.08, BEAT * 4, 4.6);
    }

    /* THE DEEP: the whole run is one piece. k is how far down the run you are (0 at the first room, 1 at the bottom) */
    /* each descent plays the Deep's score its own way: its own falling bell line, bass in nines, glass in elevens and
       reed phrases, chosen from the run's seed. The layers still arrive in the same order, so every run builds */
    deepVariant(seed) {
      if (this._dv && this._dv.seed === seed) return this._dv;
      const r = mulberry((seed || 1) * 7919 + 13), pick = (a) => a[Math.floor(r() * a.length)];
      const jit = () => (r() - 0.5) * 0.04;
      return (this._dv = {
        seed,
        fall: pick([[5, 4, 2, 1, 0, 5, 4, 2, 0], [4, 2, 1, 0, 5, 4, 1, 0, 0], [5, 5, 4, 2, 4, 2, 1, 0, 0], [2, 1, 0, 5, 4, 2, 4, 1, 0], [5, 4, 4, 2, 1, 1, 0, 2, 0]]),
        bellEvery: pick([6, 6, 4, 8]),
        os: pick([[0, 0, 4, 0, 2, 0, 5, 4, 1], [0, 4, 0, 5, 0, 2, 0, 1, 4], [0, 0, 2, 0, 4, 5, 0, 4, 2], [0, 5, 4, 0, 0, 2, 1, 0, 4]]),
        ar: pick([[0, 2, 4, 5, 4, 2, 1, 0, 4, 5, 2], [5, 4, 2, 0, 2, 4, 5, 1, 0, 2, 4], [0, 4, 2, 5, 1, 4, 0, 2, 5, 4, 1], [2, 4, 5, 4, 2, 0, 1, 2, 4, 0, 5]]),
        reed: pick([[[0, 4], [2, 1], [5, 4], [4, 0]], [[4, 5], [2, 0], [1, 2], [4, 0]], [[5, 4], [4, 2], [2, 1], [1, 0]]]),
        mach: pick([[0, 0, 4, 0, 5, 0, 4, 2], [0, 4, 0, 0, 2, 0, 5, 0], [0, 0, 5, 4, 0, 0, 2, 4]]),
        oct: pick([16, 16, 8]),
        // when each layer arrives: the same order every run, the moments shift a little
        th: [0.08 + jit(), 0.18 + jit(), 0.32 + jit(), 0.46 + jit(), 0.58 + jit(), 0.7 + jit(), 0.84 + jit() * 0.5],
      });
    }
    score_deep(t, n, e) {
      const D = Live.deep || { k: 0 }, k = D.k, r = this.rnd, s8 = n % 8, V = this.deepVariant(D.seed), th = V.th;
      const v = 0.6 + 0.4 * e;
      // the heart: slow at the top, faster and harder the deeper you are
      const hb = k < 0.3 ? 8 : k < 0.75 ? 4 : 2;
      if (n % hb === 0) { const hv = 0.26 + 0.3 * k; this.thump(t, 44, hv, 0.5); if (hb > 2) this.thump(t + 0.19, 44, hv * 0.55, 0.3); }
      // always: a bell line falling through the palette, one note every six steps, in a phrase of nine
      const fall = V.fall, be = V.bellEvery;
      if (n % be === 0) { const i = Math.floor(n / be) % 9; this.bell(t, fold(F0 * this.pick(fall[i]) * (i < 5 ? V.oct : V.oct / 2), 220, 1200), 0.4 + 0.2 * k, 3.4); }
      // the floor of the sound: a slow swell every two bars
      if (k > th[0] && n % 16 === 0) this.noiseHit(t, BEAT * 7, 'lowpass', 120, 420 + 500 * k, 0.05 + 0.05 * k, 0.9, BEAT * 3);
      // a low ostinato in nines
      if (k > th[1] && n % 2 === 0) { const os = V.os; this.pluckBass(t, fold(F0 * this.pick(os[(n / 2) % 9]) * 2, 40, 90), 0.45 * v, STEP * 1.8); }
      // glass, in elevens, on the off-steps
      if (k > th[2] && n % 2 === 1) { const ar = V.ar; if (r() < 0.55 + 0.4 * k) this.glassPing(t, fold(F0 * this.pick(ar[((n - 1) / 2) % 11]) * 16, 500, 1800), 0.35 + 0.3 * k, 1.3); }
      // the great drums
      if (k > th[3]) { if (s8 === 0) this.taiko(t, 0.45 + 0.35 * k, 34); if (s8 === 6 && k > th[4]) this.taiko(t, 0.3, 40); }
      // the machine underneath
      if (k > th[4]) this.machine(t, fold(F0 * this.pick(V.mach[s8]) * 2, 46, 100), s8 === 0 ? 0.7 : 0.4, STEP * 0.6);
      // a reed over the top: four long phrases
      if (k > th[5] && n % 16 === 0) { const ph = V.reed[Math.floor(n / 64) % 4 % V.reed.length]; this.reed(t, fold(F0 * this.pick(ph[(n / 16) % 2]) * 4, 130, 270), 0.07 + 0.03 * k, BEAT * 7, 4.4); }
      // nearly there: racing ticks, rising air, the nerve chord
      if (k > th[6]) {
        if (n % 1 === 0 && r() < 0.6) this.tick(t, 0.25 + 0.2 * k, 1800 + 1400 * r());
        if (n % 32 === 24) this.noiseHit(t, BEAT * 4, 'bandpass', 300, 4200, 0.06, 1.1, BEAT * 3.5);
        if (n % 32 === 16) { this.bell(t, fold(F0 * 19 * this.fl.tr, 700, 1500), 0.3, 3); this.bell(t + 0.04, fold(F0 * 21 * this.fl.tr, 700, 1500), 0.3, 3); }
      }
      // the bottom: a chord at every bar
      if (k >= 0.97 && s8 === 0) [0, 4, 5].forEach((d, j) => this.bell(t + j * 0.05, fold(F0 * this.pick(d) * 8, 280, 900), 0.45, 4.5));
    }

    /* ----------------------------------------------------------- sound effects */
    sfxNoise(t, dur, type, f0, f1, vel, q) {
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = type; bp.Q.value = q || 1;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(bp); bp.connect(g); g.connect(this.sfxBus);
      const sd = c.createGain(); sd.gain.value = 0.25; g.connect(sd); sd.connect(this.revSend);
      s.start(t, this.rnd() * 2); s.stop(t + dur + 0.05);
    }
    sfxTone(t, f0, f1, dur, vel, type) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
      const sd = c.createGain(); sd.gain.value = 0.3; g.connect(sd); sd.connect(this.revSend);
    }
    sfx(name, t, a) {
      a = a || {};
      const v = a.v === undefined ? 1 : a.v;
      switch (name) {
        case 'jump': this.sfxNoise(t, 0.12, 'bandpass', 500, 1400, 0.10 * v, 1.2); this.sfxTone(t, 190, 330, 0.12, 0.06 * v); break;
        case 'land': this.sfxNoise(t, 0.16, 'lowpass', 600, 120, 0.22 * v, 0.7); this.sfxTone(t, 90, 48, 0.2, 0.18 * v); break;
        case 'step': this.sfxNoise(t, 0.05, 'bandpass', 900 + 400 * this.rnd(), 500, 0.05 * v, 2); break;
        case 'roll': this.sfxNoise(t, 0.36, 'bandpass', 380, 1100, 0.16 * v, 1.6); break;
        case 'wjump': this.sfxNoise(t, 0.1, 'highpass', 1800, 900, 0.10 * v, 1); this.sfxTone(t, 260, 480, 0.14, 0.08 * v, 'triangle'); break;
        case 'death': {
          this.sfxTone(t, 380, 48, 1.4, 0.34, 'sawtooth'); this.sfxNoise(t, 1.1, 'lowpass', 2400, 90, 0.34, 0.8);
          this.sfxTone(t, F0 * 19, F0 * 19 * 0.5, 1.0, 0.12); this.sfxTone(t, F0 * 21, F0 * 21 * 0.5, 1.0, 0.12); break;
        }
        case 'respawn': { for (let i = 0; i < 3; i++) this.bell(t + i * 0.09, F0 * 8 * PALETTE[[0, 4, 5][i]] * 0.5 * 2, 0.5, 1.8); break; }
        case 'check': { const seq = [1, 3 / 2, 2, 7 / 4, 3, 7 / 2]; seq.forEach((r, i) => this.bell(t + i * 0.12, F0 * 8 * r, 0.7, 3.2)); this.sfxNoise(t, 0.6, 'bandpass', 300, 2400, 0.09, 1.5); break; }
        case 'beamOn': this.sfxTone(t, 160, 70, 0.28, 0.16 * v, 'sine'); this.sfxNoise(t, 0.22, 'highpass', 3600, 2200, 0.05 * v, 0.7); break;
        case 'win': {
          const hs = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 21, 24];
          hs.forEach((h, i) => this.bell(t + i * 0.11, F0 * h * 2, 0.8, 5.5));
          this.sfxTone(t, F0, F0 * 2, 3.5, 0.3, 'sine'); this.sfxNoise(t, 3.5, 'bandpass', 600, 5200, 0.12, 0.8); break;
        }
        case 'caught': {
          this.sfxTone(t, F0 * 19, F0 * 19 * 0.96, 0.5, 0.16 * v, 'sawtooth'); this.sfxTone(t, F0 * 21, F0 * 21 * 0.95, 0.5, 0.14 * v, 'sawtooth');
          this.sfxNoise(t, 0.35, 'bandpass', 3400, 1500, 0.12 * v, 2.5); this.sfxTone(t, 120, 60, 0.3, 0.2 * v); break;
        }
        case 'ui': this.bell(t, F0 * 8 * 1.5, 0.35, 0.7); break;
        case 'nope': this.sfxTone(t, F0 * 4 * 7 / 4, F0 * 4 * 3 / 2, 0.18, 0.06, 'triangle'); this.sfxNoise(t, 0.08, 'bandpass', 900, 500, 0.04, 2); break;
        case 'seeker': {                    // a monitor powering on: a rising whine, then the eyes open with a chord
          this.sfxTone(t, 60, 1200, 0.9, 0.08, 'square'); this.sfxNoise(t, 0.5, 'highpass', 6000, 9000, 0.04, 0.7);
          [1, 3 / 2, 2, 9 / 4, 3].forEach((r, i) => this.bell(t + 0.8 + i * 0.09, F0 * 8 * r, 0.65, 3.4));
          break;
        }
        case 'eclipse': this.sfxTone(t, F0 * 16, F0 * 4, 0.35, 0.10, 'sine'); this.sfxTone(t, F0 * 24, F0 * 6, 0.3, 0.05, 'triangle'); this.sfxNoise(t, 0.4, 'bandpass', 3000, 600, 0.06, 1.2); break;
        case 'bounce': this.sfxTone(t, F0 * 2, F0 * 6, 0.22, 0.14, 'sine'); this.sfxNoise(t, 0.12, 'lowpass', 900, 200, 0.10, 1); break;
        case 'hush': [2, 3 / 2, 1].forEach((r, i) => this.bell(t + i * 0.1, F0 * 8 * r, 0.5, 2.6)); this.sfxNoise(t, 0.6, 'bandpass', 2400, 300, 0.05, 1.5); break;
        case 'eclend': this.sfxTone(t, F0 * 4, F0 * 12, 0.25, 0.06, 'sine'); break;
        case 'start': { [1, 3 / 2, 2, 7 / 4].forEach((r, i) => this.bell(t + i * 0.16, F0 * 4 * r, 0.7, 4)); this.thump(t, 48, 0.8, 1.2); break; }
      }
    }
  }

  /* ------------------------------------------------------------------ live game wrapper */
  const Live = {
    ctx: null, eng: null, started: false, muted: false, timer: null, nextStep: 0, stepN: 0, t0: 0, params: { energy: 0.2, fear: 0 },
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.eng = new Engine(this.ctx, this.ctx.destination, { volume: 0.7 });
        this.eng.setParams(this.ctx.currentTime, { energy: 0.2, fear: 0 });
        this.eng.setRoot(this.ctx.currentTime, 0);
        if (this.themeIdx !== undefined) this.setTheme(this.themeIdx);
        this.started = true;
        this.t0 = this.ctx.currentTime;
        this.stepN = 0; this.nextStep = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.pump(), 30);
      } catch (e) { this.ctx = null; return false; }
      return true;
    },
    pump() {
      const c = this.ctx; if (!c || c.state !== 'running' || this.paused) return;
      const horizon = c.currentTime + 0.25;
      let guard = 0;
      while (this.nextStep < horizon && guard++ < 8) {
        if (this.nextStep < c.currentTime - 0.5) { this.nextStep = c.currentTime + 0.05; }
        this.eng.step(this.nextStep, this.stepN, this.params);
        this.nextStep += STEP; this.stepN++;
      }
    },
    setTheme(i) {
      this.themeIdx = i;
      if (!this.eng) return;
      const fl = FLAVOURS[i] || FLAVOURS[0];
      if (fl === this.eng.fl) return;
      this.eng.fl = fl; const idx = this.eng.rootIdx; this.eng.rootIdx = -1;
      this.eng.applyRoom(this.ctx.currentTime);
      this.eng.setRoot(this.ctx.currentTime + 0.05, Math.max(0, idx));
    },
    setMood(e, rootIdx) {
      if (!this.eng) return;
      this.params.energy = e;
      this.eng.setRoot(this.ctx.currentTime + 0.05, rootIdx);
    },
    update(fear, duck) {
      if (!this.eng) return;
      this.params.fear = fear;
      this.eng.setParams(this.ctx.currentTime, { energy: this.params.energy, fear, duck: this.muted ? 0 : (duck === undefined ? 1 : duck) });
    },
    sfx(name, a) { if (this.eng && !this.muted && this.ctx.state === 'running') this.eng.sfx(name, this.ctx.currentTime + 0.005, a); },
    setPaused(p) { this.paused = p; if (this.ctx) { if (p) this.eng.setParams(this.ctx.currentTime, { energy: this.params.energy, fear: 0, duck: 0.35 }); } },
    toggleMute() { this.muted = !this.muted; if (this.eng) this.eng.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.1); return this.muted; },
  };

  /* ------------------------------------------------------------------ offline soundtrack render */
  // arrangement: [seconds, energy, rootIdx]
  const ARRANGEMENT = [[0, 0.12, 0], [24, 0.22, 0], [48, 0.34, 4], [72, 0.46, 2], [96, 0.58, 5], [120, 0.72, 1], [144, 0.86, 3], [168, 1.0, 0], [200, 0.66, 4], [224, 0.30, 0], [248, 0.12, 0]];
  async function renderTrack(seconds, sampleRate, level) {
    const OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    const rate = sampleRate || 44100;
    const ctx = new OAC(2, Math.floor(seconds * rate), rate);
    const eng = new Engine(ctx, ctx.destination, { offline: true, volume: 0.7, seed: 48 });
    if (level) { eng.fl = FLAVOURS[level] || FLAVOURS[0]; eng.applyRoom(0); }
    let ai = 0;
    const steps = Math.floor(seconds / STEP);
    let lastParam = -1;
    for (let n = 0; n < steps; n++) {
      const t = n * STEP;
      while (ai + 1 < ARRANGEMENT.length && ARRANGEMENT[ai + 1][0] <= t) ai++;
      const a = ARRANGEMENT[ai], b = ARRANGEMENT[Math.min(ARRANGEMENT.length - 1, ai + 1)];
      const k = b[0] > a[0] ? Math.min(1, (t - a[0]) / (b[0] - a[0])) : 0;
      const e = a[1] + (b[1] - a[1]) * k * k * (3 - 2 * k);
      if (n === 0 || a[2] !== eng.rootIdx) eng.setRoot(t, a[2]);
      const fear = e > 0.8 ? 0.35 + 0.25 * Math.sin(t * 0.7) : 0.05;
      if (t - lastParam >= 0.5) { eng.setParams(t, { energy: e, fear }); lastParam = t; }
      eng.step(t, n, { energy: e });
    }
    // closing chime
    eng.sfx('check', seconds - 14);
    return ctx.startRendering();
  }

  global.DwellerAudio = { Live, Engine, renderTrack, PALETTE, F0, BEAT, STEP, hz };
})(typeof globalThis !== 'undefined' ? globalThis : this);
