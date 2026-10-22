// node test/archive.js <outdir> : the Codex room after the Core: in through the great door, a seeker wakes, one is
// taken along, the hole leads into The Deep, a run ends and you come back beside the pedestal, and out to the town
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  const codex = [1895, 579, 1146, 330, 151, 777, 1500, 2000, 12, 401, 1454, 88, 2111, 903, 1200, 64, 1777, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
  await page.evaluate((codex) => window.__dweller.setProgress({ beaten: [1, 1, 1, 1, 1, 1].map(Boolean), comp: true, fused: true, core: true, snv: 2, seekerId: 1895, codex, deepBest: 5, archSeen: false, archNew: true }), codex);
  await page.waitForTimeout(700); await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const st = () => page.evaluate(() => { const d = window.__dweller; return { mode: d.mode, lvl: d.level, x: Math.round(d.state && d.state.x), y: Math.round(d.state && d.state.y) }; });
  // the companion leads toward the great door
  await page.evaluate(() => { const d = window.__dweller; d.town(); d.teleportTown(190 * 6, 230); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/a0_lead.png' });
  await page.evaluate(() => window.__dweller.teleportTown(234 * 6 - 2.5, 37 * 6 - 10)); await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/a1_door.png' });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1500);
  console.log('in', await st());
  await page.screenshot({ path: out + '/a2_enter.png' });
  // walk to a wall seeker and wake it
  const sl = await page.evaluate(() => { const A0 = window.__dweller.world.level.archive; return [A0.floor, A0.wall, A0.high, A0.pedestal]; });
  for (const [k, p] of [['floor', sl[0][1]], ['wall', sl[1][3]], ['high', sl[2][3]]]) {
    await page.evaluate((p) => window.__dweller.teleport(p[0] - 2.5, p[1] - 10), p); await page.waitForTimeout(1400);
    await page.screenshot({ path: `${out}/a3_${k}.png` });
  }
  await page.keyboard.press('KeyE'); await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/a4_take.png' });
  console.log('companion now', await page.evaluate(() => window.__dweller.progress.seekerId));
  // the newest, on its pedestal
  await page.evaluate((p) => window.__dweller.teleport(p[0] - 2.5, p[1] - 10), sl[3]); await page.waitForTimeout(1400);
  await page.screenshot({ path: out + '/a5_pedestal.png' });
  // into the hole
  await page.evaluate(() => { const A0 = window.__dweller.world.level.archive; window.__dweller.teleport((A0.hole[0] + A0.hole[1]) / 2 - 2.5, A0.hole[2] + 10); });
  await page.waitForTimeout(3000);
  console.log('fell', await st());
  await page.screenshot({ path: out + '/a6_deep.png' });
  await page.evaluate(() => { window.__dweller.state.ex = 1.2; }); await page.waitForTimeout(2500); await page.keyboard.press('Space'); await page.waitForTimeout(1200);
  console.log('back', await st());
  await page.screenshot({ path: out + '/a7_back.png' });
  await page.evaluate(() => window.__dweller.teleport(30, 540)); await page.keyboard.down('KeyA'); await page.waitForTimeout(1200); await page.keyboard.up('KeyA'); await page.waitForTimeout(600);
  console.log('out', await st());
  console.log('errors', errs.length ? errs.slice(0, 4).join(' | ') : 'none');
  await b.close();
})();
