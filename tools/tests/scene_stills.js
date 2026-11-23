// The no-3D fallback stills for the animated beats, rendered from the same scene (so the still matches the live story).
//   URL=… node tools/tests/scene_stills.js web/national/assets/story
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
// the truck held over the box; the carton lifted out, truck on top; the truck lifted into the lamplight in the sorting room
// (times: seconds or timeline marks ± seconds)       ONLY=sorting.jpg renders just that one
const SHOTS = [['donation.jpg', 8.75], ['collection.jpg', 22.6], ['sorting.jpg', 's_lift1+0.45']].filter(([f]) => !process.env.ONLY || process.env.ONLY.split(',').includes(f));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); p.setDefaultTimeout(600000);
  await p.goto(BASE + '?capture=1&q=high', { timeout: 600000 });
  await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
  const T = await p.evaluate(() => window.__nat.sceneTimes());
  const at = (v) => { if (typeof v === 'number') return v; const m = /^(\w+)\s*([+-][\d.]+)?$/.exec(v); return T[m[1]] + (m[2] ? +m[2] : 0); };
  for (const [f, t0] of SHOTS) { const t = at(t0); const url = await p.evaluate((t) => window.__nat.sceneFrame(t), t); fs.writeFileSync(`${out}/${f}`, Buffer.from(url.split(',')[1], 'base64')); console.log('still', f, t); }
  await b.close();
})();
