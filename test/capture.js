// usage: node test/capture.js <level> <every-seconds> <out-prefix> : replay the solution, screenshot every N game seconds
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const L = +process.argv[2], every = +process.argv[3], pre = process.argv[4];
  const sol = JSON.parse(fs.readFileSync(`build/solution${L}.json`));
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space');
  await page.evaluate(([sol, L]) => { const d = window.__dweller; d.setProgress({ comp: L >= 3 }); d.startLevel(L - 1, true); d.replay(sol, 1); }, [sol, L]);
  let next = 0, i = 0;
  while (true) {
    const r = await page.evaluate(() => { const d = window.__dweller; return { t: d.ticks, won: d.state.won, m: d.mode }; });
    if (r.won || r.m === 'win' || r.t >= sol.length) break;
    if (r.t >= next) {
      await page.evaluate(() => window.__dweller.setSpeed(0));
      await page.screenshot({ path: `${pre}_${String(i++).padStart(3, '0')}.png` });
      await page.evaluate(() => window.__dweller.setSpeed(8));
      next += every * 96;
    }
    await page.waitForTimeout(20);
  }
  console.log('shots', i, 'errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
