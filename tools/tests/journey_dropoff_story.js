// automated walkthrough: screenshots + event log of the three paths
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2], qs = process.argv[3] || '', W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ' + m.text()); });
  await p.addInitScript(() => { window.__dtMax = 0.5; });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?' + qs);
  const shot = async (n) => { await p.evaluate(() => window.__journey.world.host && window.__journey.world.host.setPaused(true)); await wait(3000); await p.screenshot({ path: `${out}/${n}.png`, timeout: 400000 }); await p.evaluate(() => window.__journey.world.host && window.__journey.world.host.setPaused(false)); console.log('shot', n, await p.evaluate(() => window.__journey.state())); };
  await wait(300); await p.screenshot({ path: `${out}/01_landing_now.png`, timeout: 180000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 400000, polling: 1000 });
  await wait(3000); await shot('02_landing_ready');
  await p.click('#enter');
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 400000, polling: 1000 });
  await wait(2500); await shot('03_village');
  await p.evaluate(() => window.__journey.onHotspot('shop'));
  await p.waitForFunction(() => !window.__journey.world.host.moving, null, { timeout: 200000, polling: 500 }); await wait(1500);
  await shot('04_shop_card');
  await p.click('#cardActions button:has-text("Find a toy drop-off")');   // (the card's primary action became "Step inside the toy shop")
  await p.fill('#zip', '10001'); await p.click('#zipForm button[type=submit]'); await wait(500);
  await shot('05_results');
  await p.click('[data-choose="0"]'); await wait(500); await shot('06_thanks');
  await p.click('#dropoff [data-close].btn'); if (await p.isVisible('#cardClose')) await p.click('#cardClose');   // (the drop-off action already closes the card)
  await wait(1000);
  await p.evaluate(() => window.__journey.startStory('test'));
  for (const [n, at] of [['07_story_a', 2.5], ['08_story_b', 8.5], ['09_story_c', 13.5]]) {
    await p.waitForFunction((at) => window.__journey.world.story.time >= at, at, { timeout: 400000, polling: 300 });
    await p.evaluate(() => { window.__dtMax = 0.0001; }); await wait(2500);
    await shot(n); await p.evaluate(() => { window.__dtMax = 0.5; });
  }
  await p.waitForFunction(() => window.__journey.world.story.ended, null, { timeout: 400000, polling: 500 }); await wait(1500);
  await shot('10_story_end');
  const ev = await p.evaluate(() => window.__journey.tracker.session.events.map((e) => `${(e.t / 1000).toFixed(1)} ${e.name} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['t', 'name'].includes(k))))}`));
  fs.writeFileSync(`${out}/events.txt`, ev.join('\n')); console.log(ev.slice(-12).join('\n'));
  await b.close();
})();
