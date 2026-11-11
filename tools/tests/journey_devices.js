const { chromium, devices } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const U = (process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  async function page(opts) { const c = await b.newContext(opts); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(e.message)); await p.addInitScript(() => { window.__dtMax = 0.5; }); return p; }
  const snap = async (p, n) => { await p.evaluate(() => window.__journey?.world?.host?.setPaused(true)); await wait(300); await p.screenshot({ path: `${out}/${n}.png`, timeout: 180000 }); await p.evaluate(() => window.__journey?.world?.host?.setPaused(false)); console.log('shot', n); };
  // 1. direct variant, desktop (no 3D at all)
  let p = await page({ viewport: { width: 1280, height: 720 } });
  await p.goto(U + 'variant=direct'); await wait(1500); await snap(p, 'direct_desktop');
  await p.click('.choice-primary'); await p.fill('#zip', '1234'); await p.click('#zipForm button[type=submit]'); await wait(300); await snap(p, 'direct_ziperror');
  await p.close();
  // 2. simple view on a phone
  p = await page({ ...devices['iPhone 13'] });
  await p.goto(U + 'lite=1'); await wait(1500); await snap(p, 'lite_phone');
  await p.click('[data-fb=story]'); await wait(300); await snap(p, 'lite_phone_story');
  await p.close();
  // 3. phone, full 3D: landing, village, story caption
  p = await page({ ...devices['iPhone 13'] });
  await p.goto(U + 'q=low&capture=1');
  await p.waitForFunction(() => window.__journey.world.story, null, { timeout: 400000, polling: 1000 }); await wait(1500);
  await snap(p, 'phone_landing');
  await p.click('#enter');
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 400000, polling: 1000 }); await wait(2000);
  await p.evaluate(() => document.getElementById('toast').hidden = true);
  await snap(p, 'phone_village');
  await p.evaluate(() => window.__journey.startStory('test'));
  await p.waitForFunction(() => window.__journey.world.story.time > 9, null, { timeout: 400000, polling: 500 });
  await snap(p, 'phone_story');
  await p.close();
  // 4. flat-map hand-off, desktop
  p = await page({ viewport: { width: 1280, height: 720 } });
  await p.goto(U + 'map=flat&q=low&capture=1');
  await p.waitForFunction(() => window.__journey.world.story, null, { timeout: 400000, polling: 1000 }); await wait(1000);
  await p.evaluate(() => { document.getElementById('landing').hidden = true; });
  await snap(p, 'flat_map');
  await p.evaluate(() => { document.getElementById('landing').hidden = false; });
  await p.evaluate(() => window.__journey.enterTown('test'));
  await p.waitForFunction(() => window.__journey.state() === 'village', null, { timeout: 400000, polling: 1000 }); await wait(1500);
  await p.evaluate(() => document.getElementById('toast').hidden = true);
  await snap(p, 'flat_arrived');
  console.log('ERRORS', JSON.stringify(errs));
  console.log(JSON.stringify(await p.evaluate(() => window.__journey.tracker.session.events.map((e) => e.name + (e.kind ? ':' + e.kind : '')))));
  await b.close();
})();
