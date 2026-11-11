// Clay vs textile, from identical cameras, inside the real journey (experiment/textile-toytown).
//   node textile_compare.js OUTDIR [views]       views: elevated,street,closeup,side,marine (default: all)
// Writes OUTDIR/<view>_<look>.jpg for clay, textile and felt (env LOOKS to choose) and stats.json (draw calls,
// triangles, each corner's build time).
// SwiftShader (no GPU): draw calls and triangles are exact; frame times are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const want = (process.argv[3] || 'elevated,street,closeup,side,marine').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore&look=textile', { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  await p.evaluate(() => { const w = window.__journey.world; w.host.setPaused(true); w.map.unmount(); });
  const stats = { views: {} };
  for (const view of want) for (const look of (process.env.LOOKS || 'clay,textile,felt').split(',')) {
    const r = await p.evaluate(([view, look]) => {
      const w = window.__journey.world, h = w.host, T = h.THREE, st = w.story, B = (x, y, z) => new T.Vector3(x, z, -y);
      h.setLook(look);
      const poses = {
        elevated: { pos: B(-8.5, -17.5, 9.5), look: B(2.0, 0.5, 1.6), fov: 50 },
        street: { pos: B(9.4, -6.6, 1.3), look: B(0.2, -0.8, 2.1), fov: 55 },
        closeup: { pos: B(-1.6, -4.6, 1.9), look: B(0.6, 0.0, 2.2), fov: 42 },
        side: { pos: B(-8.2, -3.0, 3.8), look: B(0.4, 2.0, 3.0), fov: 52 },
      };
      let pose;
      if (view === 'marine') { const bt = st.beats(); pose = st.seek(bt.lift + 0.7); pose = { ...pose, pos: pose.pos.clone().lerp(pose.look, 0.35) }; }
      else { st.reset(); pose = poses[view]; }
      h.setPose(pose); h.frame(1 / 60); h.renderer.info.reset(); h.frame(1 / 60);
      return { url: h.renderer.domElement.toDataURL('image/jpeg', 0.88), ...h.stats() };
    }, [view, look]);
    fs.writeFileSync(`${out}/${view}_${look}.jpg`, Buffer.from(r.url.split(',')[1], 'base64'));
    stats.views[`${view}_${look}`] = { calls: r.calls, triangles: r.triangles };
    console.log(view, look, r.calls, 'calls', r.triangles, 'triangles');
  }
  stats.corners = await p.evaluate(() => Object.fromEntries(Object.entries(window.__journey.world.host.textile.corners).map(([k, c]) => [k, { buildMs: Math.round(c.buildMs), triangles: c.triangles }])));
  stats.errors = errors;
  fs.writeFileSync(`${out}/stats.json`, JSON.stringify(stats, null, 1));
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors', JSON.stringify(stats.corners));
  await b.close();
})();
