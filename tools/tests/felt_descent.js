// The real map → Toy Town descent, stepped frame by frame (fixed 1/30 s steps, so it is independent of SwiftShader's
// speed), from the map's own enter() through the village's arrival moves. Writes OUTDIR/descent_NN.jpg and a contact
// sheet is left to the caller; prints the camera distance, felt crossfade and look at each saved frame.
//   node felt_descent.js OUTDIR [query]     query default: look=felt
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const qs = process.argv[3] || 'look=felt';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore&' + qs, { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  // start the real descent (map.enter then village.enter), but drive the clock ourselves
  await p.evaluate(() => {
    const w = window.__journey.world, h = w.host; h.setPaused(true);
    window.__desc = { done: false };
    (async () => { const ho = await w.map.enter('toytown', {}); await w.village.enter(ho, {}); window.__desc.done = true; })();
  });
  const every = +(process.env.EVERY || 12), maxF = +(process.env.MAXF || 330);
  for (let f = 0, n = 0; f < maxF; f++) {
    const r = await p.evaluate(([save]) => {
      const h = window.__journey.world.host; h.frame(1 / 30);
      if (!save) return { done: window.__desc.done };
      const c = h.cur;
      return { done: window.__desc.done, url: h.renderer.domElement.toDataURL('image/jpeg', 0.85), dist: c.pos.distanceTo(c.look).toFixed(1),
        pos: c.pos.toArray().map((x) => x.toFixed(1)).join(','), mix: h.feltMix != null ? h.feltMix.toFixed(2) : '-' };
    }, [f % every === 0]);
    if (r.url) { fs.writeFileSync(`${out}/descent_${String(n++).padStart(2, '0')}.jpg`, Buffer.from(r.url.split(',')[1], 'base64')); console.log(f, 'dist', r.dist, 'pos', r.pos, 'felt', r.mix); }
    if (r.done && f % every === 0) { console.log('arrived at frame', f); break; }
  }
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
  await b.close();
})();
