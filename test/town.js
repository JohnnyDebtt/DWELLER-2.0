// usage: node test/town.js <out-dir> [w h] : screenshots of the town (title, walking along, doors, well room)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const out = process.argv[2], W = +(process.argv[3] || 960), H = +(process.argv[4] || 540);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  const prog = process.argv[5] ? JSON.parse(process.argv[5]) : null;
  if (prog) await page.evaluate((p) => window.__dweller.setProgress(p), prog);
  await page.waitForTimeout(3300);
  await page.screenshot({ path: out + '/t0_title.png' });
  await page.keyboard.press('Space'); await page.waitForTimeout(1200);
  const TS = 6;
  const spots = [[13, 'signs'], [30, 'sign3'], [46, 'door1'], [72, 'door2'], [96, 'well'], [112, 'door3'], [132, 'house'], [148, 'door4'], [168, 'door5'], [187, 'door6'], [202, 'monk'], [234, 'great']];
  for (const [tx, name] of spots) {
    await page.evaluate(([x]) => { const d = window.__dweller, s = d.townState; const gy = x >= 224 ? 37 * 6 : 40 * 6; d.teleportTown(x * 6, gy - 10); }, [tx]);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/t_${name}.png` });
  }
  // the well room
  await page.evaluate(() => { const d = window.__dweller; d.teleportTown(99 * 6, 60 * 6 - 10); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out + '/t_room.png' });
  // stand still near the woods for the eyes
  await page.evaluate(() => { const d = window.__dweller; d.teleportTown(120 * 6, 40 * 6 - 10); });
  await page.waitForTimeout(7500);
  await page.screenshot({ path: out + '/t_eyes.png' });
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
})();
