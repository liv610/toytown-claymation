// The region in clay vs felt, from identical cameras: the map board, three points on the descent into Toy Town,
// and the station. Inside the real journey (experiment/textile-toytown).
//   node felt_region.js OUTDIR [views]     views: map,descent1,descent2,descent3,station (default: all)
// Writes OUTDIR/<view>_<look>.jpg (env LOOKS, default clay,felt) and stats.json.
// SwiftShader (no GPU): draw calls and triangles are exact; frame times are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const want = (process.argv[3] || 'map,descent1,descent2,descent3,station').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore&look=felt', { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  await p.evaluate(() => { const w = window.__journey.world; w.host.setPaused(true); w.map.unmount(); });
  const stats = { views: {} };
  for (const view of want) for (const look of (process.env.LOOKS || 'clay,felt').split(',')) {
    const r = await p.evaluate(([view, look]) => {
      const w = window.__journey.world, h = w.host, T = h.THREE, B = (x, y, z) => new T.Vector3(x, z, -y);
      h.setLook(look);
      const sh = h.meta.shed, sc = B((sh[0] + sh[1]) / 2, (sh[2] + sh[3]) / 2, 0);
      const poses = {
        map: { pos: B(30, -275, 175), look: B(8, -2, 0), fov: 46 },
        descent1: { pos: B(42, -150, 85), look: B(6, -12, 0.5), fov: 47 },
        descent2: { pos: B(30, -58, 27), look: B(3, -11, 2.5), fov: 48 },
        descent3: { pos: B(10, -33, 11), look: B(1.5, -4, 3.2), fov: 50 },
        station: { pos: sc.clone().add(new T.Vector3(34, 22, 30)), look: sc.clone().add(new T.Vector3(0, 2, 0)), fov: 48 },
        hill: { pos: B(2, -14, 12), look: B(2, 14, 4), fov: 50 },            // the hillside houses behind the street
        square: { pos: B(4, -40, 30), look: B(4, -12, 2), fov: 50 },         // the houses round the square
        window: h.poses && h.poses.window ? h.poses.window : { pos: B(-1.6, -4.6, 1.9), look: B(-1.65, 0, 1.5), fov: 42 },
        windowSide: { pos: B(-4.2, -3.6, 1.7), look: B(-1.65, 0.2, 1.55), fov: 34 },   // oblique: the toys shift against the glow
      };
      h.setPose(poses[view]);
      for (let i = 0; i < 8; i++) h.frame(0.25);   // the felt street crossfade settles (it is time based, ~1.4 s)
      h.renderer.info.reset(); h.frame(1 / 60);
      return { url: h.renderer.domElement.toDataURL('image/jpeg', 0.88), ...h.stats() };
    }, [view, look]);
    fs.writeFileSync(`${out}/${view}_${look}.jpg`, Buffer.from(r.url.split(',')[1], 'base64'));
    stats.views[`${view}_${look}`] = { calls: r.calls, triangles: r.triangles };
    console.log(view, look, r.calls, 'calls', r.triangles, 'triangles');
  }
  stats.errors = errors;
  fs.writeFileSync(`${out}/stats.json`, JSON.stringify(stats, null, 1));
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
  await b.close();
})();
