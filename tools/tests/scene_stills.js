// The no-3D fallback stills for the animated beats, rendered from the same scene (so the still matches the live story).
//   URL=… node tools/tests/scene_stills.js web/national/assets/story
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SHOTS = [['donation.jpg', 8.75], ['collection.jpg', 22.6]];   // the truck held over the box; the carton lifted out, truck on top
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); p.setDefaultTimeout(600000);
  await p.goto(BASE + '?capture=1&q=high', { timeout: 600000 });
  await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
  for (const [f, t] of SHOTS) { const url = await p.evaluate((t) => window.__nat.sceneFrame(t), t); fs.writeFileSync(`${out}/${f}`, Buffer.from(url.split(',')[1], 'base64')); console.log('still', f, t); }
  await b.close();
})();
