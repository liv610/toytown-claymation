// Handmade style test: render every camera preset for the chosen styles, headless.
//   node tools/tests/handmade_views.js OUTDIR [styles=paper,felt] [cams=Hero,Elevated,Close,Street,Side,Roof] [W] [H] [extra query]
// Needs the dev server (cd web && npm run dev). SwiftShader renders on the CPU: frame times here are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs');
const [out, stylesArg = 'paper,felt', camsArg = 'Hero,Elevated,Close,Street,Side,Roof', W = '1280', H = '720', extra = ''] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H } });
  const log = [];
  p.on('pageerror', (e) => { console.log('PAGEERROR ' + e.message); log.push('PAGEERROR ' + e.message); });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + `/handmade/index.html?capture=1&dpr=1&style=${stylesArg.split(',')[0]}${extra ? '&' + extra : ''}`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 600000, polling: 500 });
  console.log('ready', (Date.now() - t0) / 1000, 's');
  for (const st of stylesArg.split(',')) {
    await p.evaluate((s) => window.__hm.setMode(s), st);
    for (const c of camsArg.split(',')) {
      const t1 = Date.now();
      const url = await p.evaluate(async (c) => { window.__hm.goCam(c, true); return window.__hm.still(4); }, c);
      fs.writeFileSync(`${out}/${st}_${c}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
      const s = await p.evaluate(() => window.__hm.stats());
      console.log(st, c, ((Date.now() - t1) / 1000).toFixed(1) + 's', JSON.stringify(s));
    }
  }
  await b.close();
})();
