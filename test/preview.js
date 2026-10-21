// node test/preview.js <outdir> : candidate link-preview pictures (1200 x 630) of the Dweller in town
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const B6 = [true, true, true, true, true, true];
const SCENES = [
  { n: 'A_two_doors', beaten: [true, true, false, false, false, false], px: 58, cam: 58, face: 1 },
  { n: 'B_great_door', beaten: B6, fused: true, px: 227, cam: 228, face: 1 },
  { n: 'C_well_collector', beaten: [true, true, true, false, false, false], px: 104, cam: 104, face: -1 },
  { n: 'D_forge_ember', beaten: [true, true, true, true, true, false], px: 158, cam: 158, face: 1 },
  { n: 'E_heart_monk', beaten: B6, px: 195, cam: 192, face: 1 },
  { n: 'F_guardian_face', beaten: [true, true, true, false, false, false], px: 103, cam: 106, face: 1, still: true },
];
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const sc of SCENES) {
    const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto('file://' + path.resolve('dist/dweller.html') + '?vh=' + (process.argv[3] || 140));
    await page.waitForFunction(() => window.__dweller);
    await page.evaluate((sc) => {
      window.__clean = true; window.__viewH = +(new URLSearchParams(location.search).get('vh') || 140); dispatchEvent(new Event('resize'));
      window.__dweller.setProgress({ beaten: sc.beaten, comp: true, fused: !!sc.fused, snv: 2, seekerId: 1895 });
      DwellerRender.setSeeker(1895);
    }, sc);
    await page.waitForTimeout(600); await page.keyboard.press('Space'); await page.waitForTimeout(200);
    await page.evaluate(() => window.__dweller.town());
    await page.evaluate((sc) => { window.__townCam = sc.cam * 6; window.__dweller.teleportTown(sc.px * 6 - (sc.face > 0 ? 6 : -6), sc.px >= 224 ? 37 * 6 - 10 : 230); }, sc);
    // a step toward where it should face, then stand still
    const key = sc.face > 0 ? 'KeyD' : 'KeyA';
    await page.keyboard.down(key); await page.waitForTimeout(90); await page.keyboard.up(key);
    await page.waitForTimeout(sc.still ? 9500 : 2500);
    if (process.argv[4]) { await page.evaluate((k) => { window.__logoSc = +k; window.__dweller.title(); }, process.argv[4]); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${out}/${sc.n}.png` });
    await page.close();
  }
  await b.close();
})();
