// Chapter 1 checks (headless Chromium, SwiftShader):
//   node national_chapter1.js OUTDIR stills [t1,t2,...]   posed stills at story times (toy already given)
//   node national_chapter1.js OUTDIR play                 real-time run from ?chapter=1: waits at the box, taps
//                                                         "Give the toy", checks it finishes and the actions still open
//   env VIEWPORT=390x844 for a phone, REDUCED=1 for prefers-reduced-motion.
// SwiftShader frame rates are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, what = 'stills', list = '0.5,2.5,5.5,7.9,8.5,9.5,12.5,14.4'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const [w, h] = (process.env.VIEWPORT || '1280x720').split('x').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const base = `http://localhost:${process.env.PORT || 8765}/national/?capture=1&q=${process.env.Q || 'medium'}`;
  if (what === 'stills') {
    await p.goto(base, { timeout: 300000 }); await p.waitForFunction(() => window.__nat, null, { timeout: 300000 });
    for (const t of list.split(',').map(Number)) {
      await p.evaluate((t) => window.__nat.story(t, true), t); await p.waitForTimeout(250);
      await p.screenshot({ path: `${out}/t${t.toFixed(1).padStart(5, '0')}.png`, timeout: 120000 });
    }
  } else {
    await p.goto(base + '&chapter=1', { timeout: 300000 }); await p.waitForFunction(() => window.__nat, null, { timeout: 300000 });
    const B = await p.evaluate(() => window.__nat.beats());
    // actions are reachable while the story runs
    await p.click('[data-action="request"]'); const dlg = await p.isVisible('#notyet'); await p.click('#notyet [data-close]');
    console.log('action dialog during story:', dlg);
    await p.waitForFunction((h) => window.__nat.state().t >= h - 0.01, B.hold, { timeout: 600000, polling: 500 });
    await p.waitForSelector('#givePrompt:not([hidden])', { timeout: 60000 });
    await p.screenshot({ path: `${out}/hold.png`, timeout: 120000 });
    console.log('waiting at the box:', JSON.stringify(await p.evaluate(() => window.__nat.state())), 'caption:', await p.textContent('#caption'));
    await p.click('#givePrompt');
    console.log('after tap:', JSON.stringify(await p.evaluate(() => window.__nat.state())));
    await p.waitForFunction(() => window.__nat.state().ended, null, { timeout: 900000, polling: 1000 });
    await p.waitForSelector('#endcard:not([hidden])');
    await p.screenshot({ path: `${out}/end.png`, timeout: 120000 });
    await p.click('#endcard [data-action="dropoff"]'); console.log('drop-off placeholder opens:', await p.isVisible('#notyet'), await p.textContent('#nyTitle'));
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await b.close();
})();
