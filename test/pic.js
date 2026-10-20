const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file:///tmp/notext.html');
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const cs = await page.evaluate(() => window.__dweller.world.checks.map(c => [c.x, c.y]));
  console.log(cs.length);
  for (const i of [1,3,5,8,10,13,15]) {
    await page.evaluate(([x,y]) => { const d = window.__dweller, s = d.state; s.grace = 99999; d.teleport(x - 22, y - 12); }, cs[i]);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `shots/pic${i}.png` });
  }
  await b.close();
})();
