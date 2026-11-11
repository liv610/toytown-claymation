const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [url, prefix, specs, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--max-old-space-size=4096'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const logs = []; p.on('pageerror', e => logs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  await p.goto(url);
  try { await p.waitForFunction('window.__ready === true', null, { timeout: 400000, polling: 1000 }); } catch (e) { console.log('timeout', logs.join('\n')); await b.close(); return; }
  for (const sp of specs.split(',')) {
    const t0 = Date.now();
    const r = await p.evaluate(`window.__shot(${isNaN(+sp) ? JSON.stringify(sp) : +sp})`);
    fs.writeFileSync(`${prefix}_${sp}.jpg`, Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(sp, (Date.now() - t0) + 'ms', 'draws', r.calls, 'tris', r.tris);
  }
  console.log(logs.slice(0, 6).join('\n'));
  await b.close();
})();
