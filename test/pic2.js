const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 2400, height: 1260 } });
  await page.goto('file:///tmp/notext.html');
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const cs = await page.evaluate(() => window.__dweller.world.checks.map(c => [c.x, c.y]));
  for (const i of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]) {
    await page.evaluate(([x,y]) => { const d = window.__dweller, s = d.state; s.grace = 99999; d.teleport(x - 14, y - 12); }, cs[i]);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `shots/pc${i}.png`, clip: { x: 600, y: 330, width: 1200, height: 630 } });
  }
  await b.close();
})();
