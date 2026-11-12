const { chromium } = require('playwright'); const fs = require('fs');
const stills = process.argv[2], rev = process.argv[3];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 800, height: 600 } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message)); p.on('console', (m) => { if (/departure/.test(m.text())) console.log(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore' + (process.env.QS ? '&' + process.env.QS : ''));
  await p.waitForFunction(() => window.__journey.world.departure, null, { timeout: 500000, polling: 1000 });
  await p.evaluate(() => { const w = window.__journey.world; w.host.setPaused(true); w.map.unmount(); w.village.leave(); w.shop.enter(); });
  const grab = (q = 0.85) => p.evaluate((q) => window.__journey.world.host.renderer.domElement.toDataURL('image/jpeg', q), q);
  const save = (path, url) => fs.writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'));
  await p.evaluate(() => { const h = window.__journey.world.host; h.setPose(window.__journey.world.shop.poses.overview); for (let i = 0; i < 3; i++) h.frame(0.05); });
  save(`${rev}/shop_overview.jpg`, await grab()); console.log('overview');
  for (const id of (process.env.NOTOYS ? [] : ['train', 'teddy', 'blocks', 'truck', 'top', 'drum'])) {
    await p.evaluate(async (id) => { const w = window.__journey.world, h = w.host; await w.shop.focus(id, { reducedMotion: true }); for (let i = 0; i < 3; i++) h.frame(0.05); }, id);
    save(`${stills}/toy_${id}.jpg`, await grab(0.82)); console.log('toy', id);
  }
  await p.setViewportSize({ width: 1100, height: 620 });
  await p.evaluate(() => { const w = window.__journey.world; w.host.resize(); w.shop.leave(); });
  for (const x of [1.5, 3.0, 6.5, 9.5, 12.5]) {
    await p.evaluate((x) => { const w = window.__journey.world, h = w.host; w.departure.seek('blue', 0x3f8a5a, x); h.frame(0.05); w.departure.seek('blue', 0x3f8a5a, x); h.frame(0.05); }, x);
    save(`${rev}/dep_${x}.jpg`, await grab()); console.log('dep', x);
  }
  await p.evaluate(() => window.__journey.world.departure.release());
  for (const x of [3.0, 9.5]) {
    await p.evaluate((x) => { const w = window.__journey.world, h = w.host; w.departure.seek('green', 0xc8342c, x); h.frame(0.05); w.departure.seek('green', 0xc8342c, x); h.frame(0.05); }, x);
    save(`${rev}/depg_${x}.jpg`, await grab()); console.log('depg', x);
  }
  await b.close();
})();
