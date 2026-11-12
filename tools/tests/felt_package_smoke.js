// Smoke test of the PACKAGED felt journey (tools/build_journey.sh with TEXTILE=1): serve the package folder
// (cd OUTDIR && python3 -m http.server 8790), then: node felt_package_smoke.js SCREENSHOT.jpg  (env PKG_URL to override).
// Checks it opens in felt with no look switch, enters Toy Town through the real descent, and reports page errors.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript(() => { window.__dtMax = 0.5; });
  await p.goto((process.env.PKG_URL || 'http://localhost:8790/journey.html')); console.log('loaded');
  await p.waitForFunction(() => window.__journey && window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  const r = await p.evaluate(() => ({ look: window.__journey.world.host.look, toggle: !!document.querySelector('.looktoggle') }));
  console.log('world ready', JSON.stringify(r)); await p.click('#enter');
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 600000, polling: 1000 });
  console.log('village'); await p.evaluate(() => window.__journey.world.host.setPaused(true));
  await p.screenshot({ path: process.argv[2], timeout: 400000 });
  console.log(JSON.stringify(r), errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
