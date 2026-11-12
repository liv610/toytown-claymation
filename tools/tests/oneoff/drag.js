const { chromium } = require('playwright');
(async () => {
  const look = process.argv[2];
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/journey/index.html?q=low&variant=explore&look=' + look, { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  await p.click('#enter'); await p.evaluate(() => { window.__dtMax = 0.05; });
  await p.waitForFunction(() => window.__journey.state() === 'village' && !window.__journey.world.host.moving, null, { timeout: 900000, polling: 1000 });
  const cam = () => p.evaluate(() => { const h = window.__journey.world.host; return { T: +h.time.toFixed(2), az: +h.controls.getAzimuthalAngle().toFixed(3), tgt: h.controls.target.toArray().map((v) => +v.toFixed(2)), pos: h.camera.position.toArray().map((v) => +v.toFixed(2)), explore: h.controls.enabled, top: (() => { const el = document.elementFromPoint(500, 350); return el ? el.tagName + '#' + el.id + '.' + el.className : null; })() }; });
  await p.evaluate(() => { const c = window.__journey.world.host.renderer.domElement; window.__ev = { down: 0, move: 0 }; c.addEventListener('pointerdown', () => window.__ev.down++); c.addEventListener('pointermove', () => window.__ev.move++); window.__ctrlEl = window.__journey.world.host.controls.domElement === c; });
  console.log(look, 'before', JSON.stringify(await cam()));
  await p.mouse.move(250, 520); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(250 + i * 25, 520 - i * 3); await p.waitForTimeout(150); } await p.mouse.up();
  await p.waitForTimeout(3000);
  console.log(look, 'after ', JSON.stringify(await cam()), 'events', JSON.stringify(await p.evaluate(() => [window.__ev, window.__ctrlEl, getComputedStyle(window.__journey.world.host.renderer.domElement).touchAction])), 'errors', JSON.stringify(errs));
  await b.close();
})();
