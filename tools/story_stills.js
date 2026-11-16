// Placeholder stills for the Toy Town story (Milestone 1 scaffolding). Renders existing scenes of the national app as
// they are (no 3D changes): Maple Hollow's Chapter 1 at two moments, and the whole country for the finale.
//   (cd web && npm run build:national && python3 -m http.server 8765)  then  node tools/story_stills.js
// The Toy Town village, window and Marine frames are copied from web/journey/assets/stills_felt (tt_*.jpg).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '../web/national/assets/story');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); p.setDefaultTimeout(600000);
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/national/index.html?capture=1&q=high');
  await p.waitForFunction(() => window.__nat, null, { timeout: 900000, polling: 1000 });
  const save = (name, url) => { fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64')); console.log(name); };
  save('country.jpg', await p.evaluate(() => window.__nat.shot(0)));
  const B = await p.evaluate(() => window.__nat.beats());
  save('mh_community.jpg', await p.evaluate(() => window.__nat.story(4.2, false)));
  save('mh_box.jpg', await p.evaluate((t) => window.__nat.story(t, true), B.hold + 1.4));
  await b.close();
})();
