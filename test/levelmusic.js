// usage: node test/levelmusic.js <seconds> [levels...] -> build/music_L<n>.wav : each level's score, rising from calm to tense
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const secs = +(process.argv[2] || 40), levels = process.argv.slice(3).map(Number);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  for (const L of (levels.length ? levels : [1, 2, 3, 4, 5, 6])) {
    const r = await page.evaluate(async ([secs, L]) => {
      const A = DwellerAudio, rate = 32000, ctx = new OfflineAudioContext(2, secs * rate, rate);
      const eng = new A.Engine(ctx, ctx.destination, { offline: true, volume: 0.7, seed: 48 });
      A.Live.themeIdx = L - 1;
      const fl = [0, 1, 2, 3, 4, 5].map(i => i);   // the flavour table is private: borrow it through Live
      const fake = { ctx, eng, setTheme: A.Live.setTheme };
      fake.setTheme(L - 1);
      const roots = [0, 4, 2, 5];
      for (let n = 0; n < secs / A.STEP; n++) {
        const t = n * A.STEP, e = 0.2 + 0.7 * Math.min(1, t / (secs * 0.85));
        if (n % 64 === 0) eng.setRoot(t, roots[(n / 64) % 4]);
        if (n % 2 === 0) eng.setParams(t, { energy: e, fear: e > 0.8 ? 0.3 : 0.03 });
        eng.step(t, n, { energy: e });
      }
      const buf = await ctx.startRendering();
      const Lc = buf.getChannelData(0), Rc = buf.getChannelData(1);
      let pk = 0, ss = 0; for (let i = 0; i < Lc.length; i++) { const v = Math.max(Math.abs(Lc[i]), Math.abs(Rc[i])); if (v > pk) pk = v; ss += Lc[i] * Lc[i]; }
      const out = new Int16Array(Lc.length * 2);
      for (let i = 0; i < Lc.length; i++) { out[2 * i] = Math.max(-1, Math.min(1, Lc[i])) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, Rc[i])) * 32767; }
      const u8 = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
      return { pk, rms: Math.sqrt(ss / Lc.length), b64: btoa(s), rate };
    }, [secs, L]);
    fs.writeFileSync(`build/music_L${L}.pcm`, Buffer.from(r.b64, 'base64'));
    console.log('level', L, 'peak', r.pk.toFixed(3), 'rms', r.rms.toFixed(4));
  }
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
