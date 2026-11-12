const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const out = process.argv[2], look = process.argv[3]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 620 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/journey/index.html?capture=1&q=low&variant=explore' + (look ? '&look=' + look : ''), { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  const snap = async (n) => { const u = await p.evaluate(() => { const h = window.__journey.world.host; h.frame(1 / 60); return h.renderer.domElement.toDataURL('image/jpeg', 0.85); }); fs.writeFileSync(`${out}/${n}.jpg`, Buffer.from(u.split(',')[1], 'base64')); };
  await p.click('#enter'); await p.waitForTimeout(4000); await snap('1_map');
  console.log('state after enter:', await p.evaluate(() => window.__journey.state()));
  // pick Toy Town on the map, as a visitor would
  const r = await p.evaluate(async () => { const w = window.__journey; try { await w.enterTown('test'); return 'enterTown ok, state ' + w.state(); } catch (e) { return 'enterTown threw: ' + e.message; } });
  console.log(r);
  await p.evaluate(() => { window.__dtMax = 0.05; });
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 900000, polling: 1000 }).catch(() => console.log('never reached village; state', 'timeout'));
  console.log('state now', await p.evaluate(() => window.__journey.state())); await snap('2_village');
  console.log('look', await p.evaluate(() => window.__journey.world.host.look), 'errors', JSON.stringify(errs));
  console.log('camera', await p.evaluate(() => { const h = window.__journey.world.host; return JSON.stringify({ pos: h.camera.position.toArray().map((v) => +v.toFixed(2)), look: h.cur.look.toArray().map((v) => +v.toFixed(2)), explore: h.controls.enabled, poses: !!h.poses }); }));
  await b.close();
})();
