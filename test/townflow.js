// node test/townflow.js <outdir> : walk the town for real (keys), enter a door, come back, fall in the well and climb out, set the crystal
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  const st = () => page.evaluate(() => { const d = window.__dweller, s = d.townState; return { mode: d.mode, x: Math.round(s.x), y: Math.round(s.y), near: d.near && d.near.k + (d.near.i ?? ''), lvl: d.level, cmp: s.cmp }; });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  console.log('begin', await st());
  await page.keyboard.down('KeyD'); await page.waitForTimeout(2400); await page.keyboard.up('KeyD'); await page.waitForTimeout(300);
  console.log('walked', await st());
  // find door I
  for (let k = 0; k < 40; k++) { const s = await st(); if (s.near === 'door0') break; const key = s.x < 270 ? 'KeyD' : 'KeyA'; await page.keyboard.down(key); await page.waitForTimeout(60); await page.keyboard.up(key); await page.waitForTimeout(60); }
  console.log('at door', await st());
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  console.log('entered', await st());
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await page.keyboard.press('KeyQ'); await page.waitForTimeout(500);
  console.log('back', await st());
  // the well: jump in from the left rim, then climb out on the rope
  await page.evaluate(() => window.__dweller.teleportTown(86 * 6, 40 * 6 - 10)); await page.waitForTimeout(300);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.down('Space'); await page.waitForTimeout(300); await page.keyboard.up('Space'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  await page.waitForTimeout(2000);
  console.log('in well', await st());
  await page.screenshot({ path: out + '/w1.png' });
  // walk to the rope and climb
  for (let k = 0; k < 30; k++) { const s = await st(); if (Math.abs(s.x + 2 - 555) < 3) break; const key = s.x + 2 < 555 ? 'KeyD' : 'KeyA'; await page.keyboard.down(key); await page.waitForTimeout(40); await page.keyboard.up(key); await page.waitForTimeout(40); }
  await page.keyboard.down('KeyW'); await page.waitForTimeout(4500); await page.keyboard.up('KeyW');
  console.log('climbed', await st());
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyD'); await page.waitForTimeout(800);
  console.log('out', await st());
  // the crystal
  await page.evaluate(() => { const d = window.__dweller; d.setProgress({ beaten: [1, 1, 1, 1, 1, 1].map(Boolean), fused: false, comp: true }); d.town(6); });
  await page.waitForTimeout(400);
  console.log('great', await st());
  await page.keyboard.press('KeyE');
  for (const t of [600, 900, 700, 1200, 1500]) { await page.waitForTimeout(t); await page.screenshot({ path: out + '/f' + t + '_' + Date.now() % 1000 + '.png' }); }
  console.log('fused', await page.evaluate(() => window.__dweller.progress.fused));
  await page.keyboard.press('KeyE'); await page.waitForTimeout(400);
  console.log('core', await st());
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
