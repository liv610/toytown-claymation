const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/textile/tests/nan.html'); await p.waitForFunction(() => window.__result, null, { timeout: 120000 });
  const r = await p.evaluate(() => window.__result); console.log(JSON.stringify({ bad: r.bad, buildMs: r.buildMs, triangles: r.triangles })); console.log(r.ledger.map((x) => x.name + ' ' + x.ms + 'ms ' + x.triangles).join('\n')); await b.close(); })();
