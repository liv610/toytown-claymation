const { chromium, devices } = require('playwright'); const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  for (const [name, opts] of [['desk', { viewport: { width: 1280, height: 800 } }], ['phone', devices['iPhone 13']]]) {
    const c = await b.newContext(opts), p = await c.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
    await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?variant=direct'); await wait(800);
    await p.screenshot({ path: `${process.argv[2]}/gd_${name}_landing.png` });
    await p.click('[data-action=gift][data-source=direct-landing]'); await wait(600);
    await p.screenshot({ path: `${process.argv[2]}/gd_${name}_pick.png` });
    await p.click('[data-toy=teddy]'); await p.fill('#gfZip', '94110'); await p.click('#gfDetail button[type=submit]'); await p.click('#coDone'); await wait(3500);
    await p.screenshot({ path: `${process.argv[2]}/gd_${name}_done.png` });
    console.log(name, await p.evaluate(() => window.__journey.tracker.session.events.map((e) => e.name).join(',')));
    await c.close();
  }
  await b.close();
})();
