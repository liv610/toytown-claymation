const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 320, height: 180 } });
  p.on('pageerror', e => console.log('ERR ' + e.message));
  await p.goto(process.argv[2]);
  await p.waitForFunction('window.__ready === true', null, { timeout: 400000, polling: 1000 });
  const a = await p.evaluate('window.__audit');
  console.log('WORST', JSON.stringify(a.worst));
  console.log('closest 8:', JSON.stringify(a.samples.slice().sort((x, y) => x[1] - y[1]).slice(0, 8)));
  await b.close();
})();
