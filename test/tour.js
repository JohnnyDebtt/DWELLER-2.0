// usage: node test/tour.js <level 1..6> : screenshots at every tether, the secret and the goal
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const L = parseInt(process.argv[2] || '1', 10);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await page.evaluate((L) => { const d = window.__dweller; d.setProgress({ comp: L >= 3 }); d.startLevel(L - 1, true); }, L);
  await page.waitForTimeout(300);
  const pts = await page.evaluate(() => { const w = window.__dweller.world; const p = w.checks.map(c => [c.x, c.y]); if (w.secret) p.push([w.secret.x + 20, w.secret.y]); p.push([w.goal.x - 30, w.goal.y + 18]); return p; });
  let i = 0;
  for (const [x, y] of pts) {
    await page.evaluate(([x, y]) => { const d = window.__dweller, s = d.state; s.grace = 1e9; d.teleport(x - 2.5 + 30, y - 10); s.vx = 0; s.vy = 0; }, [x, y]);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `shots/t${L}_${String(i).padStart(2, '0')}.png` });
    i++;
  }
  console.log('shots', i, 'errors', errs.length ? errs : 'none');
  await b.close();
})();
