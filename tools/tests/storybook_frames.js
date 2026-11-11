const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2], times = (process.argv[3] || '0,1.2,2.6,3.4,3.9,4.6,5.2,6.0,8.2').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ' + m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/storybook/index.html?capture=1');
  await p.waitForFunction(() => window.__sb, null, { timeout: 300000, polling: 500 });
  await p.evaluate(() => window.__sb.renderer.setAnimationLoop(null));
  for (const x of times) { const url = await p.evaluate((x) => window.__sb.seek(x), x); fs.writeFileSync(`${out}/t_${x}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log('t', x); }
  await b.close();
})();
