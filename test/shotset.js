// usage: node test/shotset.js <out-prefix> L:x,y [L:x,y ...]   (tile coords) -> <prefix>_<i>.png
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const pre = process.argv[2];
  const pts = process.argv.slice(3).map(s => { const [L, xy] = s.split(':'); const [x, y] = xy.split(',').map(Number); return [+L, x, y]; });
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  let i = 0, cur = -1;
  for (const [L, x, y] of pts) {
    if (L !== cur) { await page.evaluate((L) => { const d = window.__dweller; d.setProgress({ comp: L >= 3 }); d.startLevel(L - 1, true); }, L); cur = L; await page.waitForTimeout(300); }
    await page.evaluate(([x, y]) => { const d = window.__dweller, s = d.state; s.grace = 1e9; s.ex = 0; d.teleport(x * 6, y * 6 - 12); }, [x, y]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${pre}_${i++}.png` });
  }
  await b.close();
})();
