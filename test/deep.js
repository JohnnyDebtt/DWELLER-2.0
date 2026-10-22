// node test/deep.js <outdir> : the Codex door, the Codex, a full Deep run (rooms won by jumping to their way down),
// the upgrade picks, the seeker at the bottom, and a run that ends in the light
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve('dist/dweller.html'));
  await page.waitForFunction(() => window.__dweller);
  await page.evaluate(() => window.__dweller.setProgress({ beaten: [1, 1, 1, 1, 1, 1].map(Boolean), comp: true, fused: true, core: true, snv: 2, seekerId: 1895, codex: [1895] }));
  await page.waitForTimeout(800); await page.keyboard.press('Space'); await page.waitForTimeout(300);
  const st = () => page.evaluate(() => ({ mode: window.__dweller.mode, near: window.__dweller.near && window.__dweller.near.k }));
  await page.evaluate(() => { const d = window.__dweller; d.town(); d.teleportTown(234 * 6 - 2.5, 37 * 6 - 10); });
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1200);
  console.log('in the Codex', await st());
  await page.screenshot({ path: out + '/c1_codex.png' });
  await page.evaluate(() => { const A0 = window.__dweller.world.level.archive; window.__dweller.teleport((A0.hole[0] + A0.hole[1]) / 2 - 2.5, A0.hole[2] + 10); });
  await page.waitForTimeout(3000);
  console.log('descended', await st());
  await page.screenshot({ path: out + '/d0_room1.png' });
  for (let r = 0; r < 8; r++) {
    await page.evaluate(() => { const d = window.__dweller, g = d.world.goal; d.teleport(g.x - 2.5, g.y - 10); });
    await page.waitForTimeout(900);
    const m = await st();
    if (r === 0 || r === 7) await page.screenshot({ path: `${out}/d${r + 1}_after.png` });
    if (m.mode === 'deepPick') { await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space'); await page.waitForTimeout(900); }
    if (r === 3) await page.screenshot({ path: out + '/d4_room5.png' });
    console.log('room', r + 1, '->', m.mode);
  }
  // the bottom: a chest, opened with E
  await page.evaluate(() => { const d = window.__dweller, c = d.world.level.chest; d.teleport(c.x - 14, c.y - 10); });
  await page.waitForTimeout(800);
  await page.keyboard.down('KeyE'); await page.waitForTimeout(120); await page.keyboard.up('KeyE');
  await page.waitForTimeout(3600);
  await page.screenshot({ path: out + '/d9_win.png' });
  console.log('codex', await page.evaluate(() => window.__dweller.progress.codex));
  await page.keyboard.press('Space'); await page.waitForTimeout(1200);
  console.log('back in the Codex', await st(), 'new seeker on the pedestal');
  await page.screenshot({ path: out + '/c3_codex_after.png' });
  // a run that ends in the light
  await page.evaluate(() => { const A0 = window.__dweller.world.level.archive; window.__dweller.teleport((A0.hole[0] + A0.hole[1]) / 2 - 2.5, A0.hole[2] + 10); });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/d10_lives.png' });
  // the first death spends the spare life: the last tether takes you back
  await page.evaluate(() => { const s = window.__dweller.state; s.ex = 1.2; });
  await page.waitForTimeout(2600);
  console.log('after the first death', await st(), await page.evaluate(() => window.__dweller.state.dead));
  await page.screenshot({ path: out + '/d11_spared.png' });
  // the second ends the run
  await page.evaluate(() => { const s = window.__dweller.state; s.grace = 0; s.ex = 1.2; });
  await page.waitForTimeout(2500);
  console.log('died', await st(), await page.evaluate(() => window.__dweller.progress.deepBest));
  await page.screenshot({ path: out + '/d10_over.png' });
  console.log('errors', errs.length ? errs.slice(0, 5).join(' | ') : 'none');
  await b.close();
})();
