const { chromium, devices } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.evaluate(() => window.__dweller.setProgress({ beaten: [true, true, false, false, false, false], comp: true, cp: {} }));
  await page.touchscreen.tap(400, 200); await page.waitForTimeout(500);
  console.log('mode', await page.evaluate(() => window.__dweller.mode));
  await page.screenshot({ path: 'shots/phone_map.png' });
  // tap node III twice
  const pos = await page.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return [c.width, c.height]; });
  // find III by scanning: use the layout through a click near the third node using sel keys instead
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space'); await page.waitForTimeout(800);
  console.log('mode', await page.evaluate(() => [window.__dweller.mode, window.__dweller.level, document.body.className]));
  await page.screenshot({ path: 'shots/phone_play.png' });
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
