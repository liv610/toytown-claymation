const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [url, out, w, h, frames] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('ERR ' + e.message));
  await p.goto(url);
  await p.waitForFunction('window.__ready === true', null, { timeout: 400000, polling: 1000 });
  await p.exposeFunction('logRow', (r) => console.log(JSON.stringify(r)));
  const res = await p.evaluate(`window.__measure(${+frames}, (r) => window.logRow(r))`);
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log('MEMORY', JSON.stringify(res.memory), 'GPU', res.gpu, res.canvas);
  await b.close();
})();
