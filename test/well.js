const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.evaluate(() => window.__dweller.setProgress({ comp: true }));
  await page.waitForTimeout(800); await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const st = () => page.evaluate(() => { const s = window.__dweller.townState; return [Math.round(s.x), Math.round(s.y), s.st]; });
  await page.evaluate(() => window.__dweller.teleportTown(80 * 6, 230)); await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/claude-0/sn/wl0.png' });
  // walk right into the rim, hop up, step onto the cap
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space'); await page.waitForTimeout(350); await page.keyboard.up('KeyD');
  await page.waitForTimeout(800); console.log('after hop', await st());
  await page.screenshot({ path: '/tmp/claude-0/sn/wl1.png' });
  await page.keyboard.down('KeyS'); await page.waitForTimeout(5000); await page.keyboard.up('KeyS'); await page.waitForTimeout(500);
  console.log('bottom', await st());
  // back up and out
  for (let k = 0; k < 30; k++) { const s = await st(); if (Math.abs(s[0] + 2 - 555) < 3) break; const key = s[0] + 2 < 555 ? 'KeyD' : 'KeyA'; await page.keyboard.down(key); await page.waitForTimeout(40); await page.keyboard.up(key); await page.waitForTimeout(40); }
  await page.keyboard.down('KeyW'); await page.waitForTimeout(5000); await page.keyboard.up('KeyW'); console.log('top', await st());
  await page.screenshot({ path: '/tmp/claude-0/sn/wl2.png' });
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyD'); await page.waitForTimeout(600);
  console.log('out', await st(), errs);
  await b.close();
})();
