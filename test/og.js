const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots/og_title.png' });
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const g = await page.evaluate(() => window.__dweller.world.goal);
  await page.evaluate(([x,y]) => { const d = window.__dweller, s = d.state; s.grace = 99999; d.teleport(x-120, y+20); }, [g.x, g.y]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/og_crystal.png' });
  await b.close();
})();
