const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  // 1. find the seeker in level II
  await page.evaluate(() => { const d = window.__dweller; d.setProgress({ comp: false, beaten: [true, false, false, false, false, false] }); d.startLevel(1, true); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const d = window.__dweller, w = d.world, s = d.state; s.grace = 1e9;
    const v = w.level.vines.find(v => Math.abs(v[0] * 6 - w.secret.x) < 80); d.teleport(v[0] * 6 + 0.5, (v[1] + 16) * 6); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shots/sk_0_ledge.png' });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2600);
  await page.screenshot({ path: 'shots/sk_1_wall.png' });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(800); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1200);
  let r = await page.evaluate(() => ({ cmp: window.__dweller.state.cmp, saved: window.__dweller.progress.comp }));
  console.log('after chamber', JSON.stringify(r));
  await page.screenshot({ path: 'shots/sk_2_card.png' });
  // 2. eclipse a light in level III
  await page.evaluate(() => { const d = window.__dweller; d.setProgress({ comp: true }); d.startLevel(4, true); });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => { const d = window.__dweller, w = d.world, s = d.state; s.grace = 1e9;
    const l = w.lights.find(l => l.t === 'lamp' && l.hazard && l.r > 30); d.teleport(l.x - 2.5 + 40, w.goal ? 0 : 0); return { x: l.x, y: l.y, id: l.id }; });
  await page.evaluate((i) => { const d = window.__dweller; d.teleport(i.x + 20, i.y + 140); }, info);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/sk_3_before.png' });
  await page.keyboard.press('KeyE');
  for (let k = 0; k < 6; k++) { await page.waitForTimeout(250); const q = await page.evaluate(() => { const s = window.__dweller.state; return [s.cmp, s.cmpL, +s.cmpK.toFixed(2), s.cmpCD]; }); console.log('eclipse', JSON.stringify(q)); }
  await page.screenshot({ path: 'shots/sk_4_eclipse.png' });
  await page.waitForTimeout(2600);
  console.log('after', JSON.stringify(await page.evaluate(() => { const s = window.__dweller.state; return [s.cmp, s.cmpL, s.cmpK, s.cmpCD]; })));
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
