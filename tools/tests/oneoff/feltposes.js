const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8765/journey/index.html?capture=1&q=high&variant=explore&look=felt', { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  for (const k of (process.env.K || 'overview,street,tree,window').split(',')) {
    const url = await p.evaluate((k) => { const w = window.__journey.world, h = w.host; h.setPaused(true); w.map.unmount(); w.story.reset();
      const pose = (h.poses && h.poses[k]) || w.village.poses[k]; h.setPose(h.clearPose(pose)); h.frame(1 / 60); h.frame(1 / 60); return h.renderer.domElement.toDataURL('image/jpeg', 0.88); }, k);
    fs.writeFileSync(`${out}/${k}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log('shot', k);
  }
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
