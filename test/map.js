const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const errs = [];
  for (const [w, h, name, prog] of [[1280, 720, 'map_a', { beaten: [true, true, false, false, false, false], comp: true }], [1280, 720, 'map_b', { beaten: [true, true, true, true, true, false], comp: false }], [844, 390, 'map_phone', { beaten: [true, false, false, false, false, false] }], [390, 844, 'map_tall', { beaten: [true, true, false, false, false, false] }]]) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('file://' + path.resolve('dist/dweller.html'));
    await page.waitForFunction(() => window.__dweller);
    await page.evaluate((p) => { window.__dweller.setProgress(p); }, prog);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/${name}_title.png` });
    await page.keyboard.press('Space'); await page.waitForTimeout(900);
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
    await page.screenshot({ path: `shots/${name}.png` });
    await page.close();
  }
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})();
