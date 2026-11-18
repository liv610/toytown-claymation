// Frames of the Milestone 2A animated scene (the red truck's donation and collection) at given story times.
//   URL=… TIMES=0,3,7.5 SIZE=desktop|phone DPR=1 Q=medium node tools/tests/scene_frames.js OUTDIR
// Headless Chromium + SwiftShader: faithful images (each frame is the scene posed at exactly that time), no timing meaning.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 844 }, small: { width: 640, height: 360 } };
const times = (process.env.TIMES || '0,2,4,6,7.5,8.6,9.5,10.5,12.5,14,16,17.6,18.3,19.5,20.6,21.5,22.6,23.5,24.5,25.6,26.4').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const size of (process.env.SIZE || 'desktop').split(',')) {
    const p = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: +(process.env.DPR || 1), reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
    p.setDefaultTimeout(600000); const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(BASE + `?capture=1&q=${process.env.Q || 'medium'}`, { timeout: 600000 });
    await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
    for (const t of times) {
      const url = await p.evaluate((t) => window.__nat.sceneFrame(t), t);
      fs.writeFileSync(`${out}/${size}_${String(Math.round(t * 10)).padStart(3, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log(size, times.length, 'frames', errors.length ? 'errors: ' + errors.join(' | ') : '');
    await p.close();
  }
  await b.close();
})();
