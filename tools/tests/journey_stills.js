const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore');
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 500000, polling: 1000 });
  await p.evaluate(() => window.__journey.world.host.setPaused(true));
  const specs = ['map', 'village', 'window', 'story1', 'story2', 'story3'];
  for (const k of specs) {
    const url = await p.evaluate((k) => {
      const w = window.__journey.world, h = w.host, v = w.village.poses, st = w.story, bt = st.beats();
      let pose;
      if (k !== 'map') w.map.unmount();
      if (k === 'map') pose = w.map.pose;
      else if (k === 'village' || k === 'window') { st.reset(); pose = k === 'village' ? v.overview : v.window; }
      else pose = st.seek(k === 'story1' ? 3.2 : k === 'story2' ? bt.lift + 0.7 : bt.place + 0.5);
      h.setPose(pose); h.frame(1 / 60); h.frame(1 / 60);
      return h.renderer.domElement.toDataURL('image/jpeg', 0.84);
    }, k);
    fs.writeFileSync(`${out}/${k}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log('still', k);
  }
  await b.close();
})();
