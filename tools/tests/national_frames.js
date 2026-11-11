// National map: frames along the descent into Maple Hollow (u = 0 national view … 1 street level), plus load time.
//   node tools/tests/national_frames.js OUTDIR "0,0.4,0.7,0.85,1" [quality]
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2], us = (process.argv[3] || '0,0.4,0.7,0.85,0.95,1').split(',').map(Number), q = process.argv[4] || 'high';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const vp = (process.env.VIEWPORT || '1280x720').split('x').map(Number), p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ' + m.text()); });
  const t0 = Date.now();
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + `/national/index.html?capture=1&q=${q}`);
  await p.waitForFunction(() => window.__nat, null, { timeout: 400000, polling: 500 });
  console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  for (const u of us) { const url = await p.evaluate((u) => window.__nat.shot(u), u); fs.writeFileSync(`${out}/u_${u}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log('u', u); }
  await b.close();
})();
