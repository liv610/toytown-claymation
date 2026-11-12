// node story_shots.js OUTDIR "t1,t2,..." [given=1]   (env VIEWPORT=WxH)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, ts, given] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
  const [w, h] = (process.env.VIEWPORT || '1280x720').split('x').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  await p.goto(`http://localhost:8765/national/?capture=1&q=${process.env.Q || 'medium'}`, { timeout: 300000 });
  await p.waitForFunction(() => window.__nat, null, { timeout: 300000 });
  console.log('beats', JSON.stringify(await p.evaluate(() => window.__nat.beats())));
  for (const t of ts.split(',').map(Number)) {
    await p.evaluate(([t, g]) => window.__nat.story(t, g), [t, given !== '0']);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/t${String(t).padStart(5, '0')}.png`, timeout: 120000 });
  }
  await b.close();
})();
