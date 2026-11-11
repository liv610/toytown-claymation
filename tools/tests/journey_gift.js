const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2], W = 1100, H = 620; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('CONSOLE ' + m.text()); });
  await p.addInitScript(() => { window.__dtMax = 0.5; });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?q=low&capture=1');
  const J = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { await J(() => window.__journey.world.host?.setPaused(true)); await wait(6000); await p.screenshot({ path: `${out}/${n}.png`, timeout: 400000 }); await J(() => window.__journey.world.host?.setPaused(false)); console.log('shot', n, await J(() => window.__journey.state())); };
  const idle = () => p.waitForFunction(() => !window.__journey.world.host.moving, null, { timeout: 300000, polling: 500 });
  await p.waitForFunction(() => window.__journey.world.departure, null, { timeout: 500000, polling: 1000 });
  await shot('g01_landing');
  await J(() => window.__journey.enterTown('test'));
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 400000, polling: 1000 });
  await J(() => { document.getElementById('toast').hidden = true; window.__journey.onHotspot('shop'); }); await idle(); await wait(800);
  await shot('g02_shopcard');
  await p.click('#cardActions .btn-primary');
  await p.waitForFunction(() => window.__journey.state() === 'shop', null, { timeout: 200000, polling: 500 }); await wait(2500);
  await shot('g03_shop');
  for (const id of ['train', 'teddy', 'blocks']) {
    await J((id) => window.__journey.onToy(id, 'test'), id); await idle();
    await J(() => { window.__dtMax = 0.5; }); await wait(2500);
    await shot('g04_toy_' + id);
  }
  await p.click('#cardActions .btn-primary'); await wait(400);
  await shot('g05_detail');
  await p.fill('#gfZip', '60601'); await p.click('[data-wrap="green"]'); await p.click('#gfDetail button[type=submit]'); await wait(300);
  await shot('g06_checkout');
  await p.click('#coDone'); await wait(300); await shot('g07_done');
  await p.click('#doneActions .btn-primary');
  await p.waitForFunction(() => window.__journey.state() === 'departure', null, { timeout: 200000, polling: 300 });
  for (const [n, at] of [['g08_dep_a', 1.5], ['g09_dep_b', 3.0], ['g10_dep_c', 8.5]]) {
    await p.waitForFunction((at) => window.__journey.world.departure.time >= at || window.__journey.state() !== 'departure', at, { timeout: 300000, polling: 200 });
    await J(() => { window.__dtMax = 0.0001; }); await wait(1500); await shot(n); await J(() => { window.__dtMax = 0.5; });
  }
  await p.waitForFunction(() => window.__journey.state() === 'mapview', null, { timeout: 300000, polling: 500 }); await wait(4000);
  await shot('g11_map');
  await p.click('#mvActions .btn-primary');
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 200000, polling: 500 }); await wait(2500);
  await shot('g12_back');
  const ev = await J(() => window.__journey.tracker.session.events.map((e) => `${(e.t / 1000).toFixed(1)} ${e.name} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['t', 'name'].includes(k))))}`));
  fs.writeFileSync(`${out}/events.txt`, ev.join('\n')); console.log('DONE');
  await b.close();
})();
