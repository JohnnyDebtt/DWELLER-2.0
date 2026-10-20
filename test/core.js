// the final level: walk the six alcoves (teleporting, invulnerable), watch the Guardian change, shatter, fall to the end
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const cmp = process.argv[2] !== 'nocmp';
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await page.evaluate((cmp) => { const d = window.__dweller; d.setProgress({ comp: cmp, beaten: [1, 1, 1, 1, 1, 1].map(Boolean), fused: true }); d.startLevel(6, true); }, cmp);
  await page.waitForTimeout(500);
  const st = () => page.evaluate(() => { const d = window.__dweller, s = d.state; return { p: s.bP, wake: s.bWake, cp: s.cp, die: s.bDie, burst: s.bBurst, won: s.won, dead: s.dead, x: Math.round(s.x / 6), y: Math.round(s.y / 6), cmp: s.cmp, m: d.mode }; });
  const pre = cmp ? 'core' : 'corenc';
  // walk into the arena so it wakes
  await page.evaluate(() => { const d = window.__dweller, s = d.state, B = d.world.boss; s.grace = 1e9; d.teleport(B.wake + 30, B.alc[0].y - 12); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${pre}_0.png` });
  console.log('awake', JSON.stringify(await st()));
  for (let i = 0; i < 6; i++) {
    await page.evaluate((i) => { const d = window.__dweller, s = d.state, A = d.world.boss.alc[i]; s.grace = 1e9; s.ex = 0; d.teleport(A.x - 2.5, A.y - 10 - 2); }, i);
    await page.waitForTimeout(700);
    console.log('alcove', i, JSON.stringify(await st()));
    await page.evaluate(() => { const d = window.__dweller, B = d.world.boss; d.teleport(B.x - 2.5 - 60, B.y + 120); d.state.grace = 1e9; });
    await page.waitForTimeout(i === 4 ? 4500 : 1600);
    await page.screenshot({ path: `shots/${pre}_${i + 1}.png` });
  }
  await page.evaluate(() => { const d = window.__dweller, A = d.world.boss.alc[5]; d.state.grace = 1e9; d.teleport(A.x - 2.5, A.y - 12); });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `shots/${pre}_burst.png` });
  console.log('after throes', JSON.stringify(await st()));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `shots/${pre}_fall.png` });
  console.log('falling', JSON.stringify(await st()));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `shots/${pre}_end.png` });
  console.log('end', JSON.stringify(await st()));
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
