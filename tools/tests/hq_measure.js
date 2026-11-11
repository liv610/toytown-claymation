const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, w, h, frames] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('ERR ' + e.message));
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/hq/index.html?measure=1');
  await p.waitForFunction('window.__ready === true', null, { timeout: 400000, polling: 1000 });
  await p.exposeFunction('logRow', (r) => console.log(JSON.stringify(r)));
  const res = await p.evaluate(`window.TT.measure(${+frames}, (r) => window.logRow(r))`);
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ stats: res.stats, load: res.load.totalMs, gpu: res.gpu, canvas: res.canvas }));
  await b.close();
})();
