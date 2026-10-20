// usage: node test/closeup.js <level> x,y [x,y...] (tile coords) -> shots/cu<level>_<i>.png
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const L = parseInt(process.argv[2], 10);
  const pts = process.argv.slice(3).map(s => s.split(',').map(Number));
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.resolve(process.env.HTML || 'dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  await page.evaluate((L) => { const d = window.__dweller; d.setProgress({ comp: false }); d.startLevel(L - 1, true); }, L);
  let i = 0;
  for (const [x, y] of pts) {
    await page.evaluate(([x, y]) => { const d = window.__dweller, s = d.state; s.grace = 1e9; d.teleport(x * 6, y * 6 - 10); }, [x, y]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `shots/cu${L}_${i++}.png` });
  }
  await b.close();
})();
