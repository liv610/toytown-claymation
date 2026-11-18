// Frames of the Milestone 1 spike's flights (experiment/phase1-build): the Explore Toy Town descent from the national
// view to the first story shot at the Toy Town hub, and the finale's rise back. Headless Chromium + SwiftShader (no
// GPU: faithful images, no frame-rate meaning).   URL=… node tools/tests/toytown_frames.js OUTDIR [desktop|phone]
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 844 } };
const DOWN = (process.env.DOWN || '0,0.35,0.6,0.78,0.9,1').split(',').map(Number), UP = (process.env.UP || '0.3,0.6,1').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const name of (process.argv[3] ? [process.argv[3]] : Object.keys(SIZES))) {
    const p = await b.newPage({ viewport: SIZES[name], deviceScaleFactor: 2 }); p.setDefaultTimeout(600000);
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(BASE + '?capture=1&q=high', { timeout: 600000 });
    await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
    const save = async (file, fn, arg) => { const url = await p.evaluate(fn, arg); fs.writeFileSync(`${out}/${name}_${file}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log(name, file); };
    for (const u of DOWN) await save(`down_${String(Math.round(u * 100)).padStart(3, '0')}`, (u) => window.__nat.travelFrame(u), u);
    for (const u of UP) await save(`up_${String(Math.round(u * 100)).padStart(3, '0')}`, (u) => window.__nat.travelFrame(u, true), u);
    if (errors.length) console.log('page errors', errors);
    await p.close();
  }
  await b.close();
})();
