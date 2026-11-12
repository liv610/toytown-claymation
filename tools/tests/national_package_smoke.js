// Smoke test of the PACKAGED national map (tools/build_national.sh OUTDIR): serve OUTDIR
// (cd OUTDIR && python3 -m http.server 8791), then: node national_package_smoke.js SHOT.jpg  (env PKG_URL to override).
// Loads the page, checks the map comes up, grabs the country view and the end of the descent, and reports page errors.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto((process.env.PKG_URL || 'http://localhost:8791/national.html') + '?capture=1');
  await p.waitForFunction(() => window.__nat, null, { timeout: 900000, polling: 1000 });
  const url = await p.evaluate(() => window.__nat.shot(0));
  fs.writeFileSync(process.argv[2], Buffer.from(url.split(',')[1], 'base64'));
  const cap = await p.textContent('#caption');
  console.log('caption:', cap); console.log(errs.length ? 'ERRORS\n' + errs.join('\n') : 'no page errors');
  await b.close();
})();
