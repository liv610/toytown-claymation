const { chromium } = require('playwright'); const fs = require('fs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8767') + '/journey.html');
  await wait(1500);
  console.log('landing visible:', await p.isVisible('#landing'), 'variant:', await p.evaluate(() => window.__journey.tracker.session.variant));
  await p.waitForFunction(() => window.__journey.world.departure && window.__journey.world.shop, null, { timeout: 500000, polling: 2000 });
  console.log('world ready; events:', await p.evaluate(() => window.__journey.tracker.session.events.map((e) => e.name).join(',')));
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();
