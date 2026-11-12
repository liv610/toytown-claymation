// The toy shop interior in the felt look (the storybook hall): overview, a wide look round the hall, and two toys in
// focus (their tricks playing). Writes OUTDIR/shop_*.jpg and prints draw calls / triangles and the hall's build time.
//   node felt_shop.js OUTDIR
// SwiftShader (no GPU): draw calls and triangles are exact; frame times are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (/storybook shop/.test(m.text())) console.log(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore&look=felt', { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.shop, null, { timeout: 900000, polling: 1000 });
  await p.evaluate(() => { const w = window.__journey.world; w.host.setPaused(true); w.map.unmount(); w.village.leave(); w.shop.enter(); });
  const grab = async (name) => {
    const r = await p.evaluate(() => { const h = window.__journey.world.host; for (let i = 0; i < 3; i++) h.frame(0.05); h.renderer.info.reset(); h.frame(0.05); return { url: h.renderer.domElement.toDataURL('image/jpeg', 0.88), ...h.stats() }; });
    fs.writeFileSync(`${out}/shop_${name}.jpg`, Buffer.from(r.url.split(',')[1], 'base64')); console.log(name, r.calls, 'calls', r.triangles, 'triangles');
  };
  await p.evaluate(() => { const w = window.__journey.world; w.host.setPose(w.shop.poses.overview); });
  await grab('overview');
  await p.evaluate(() => { const w = window.__journey.world, h = w.host, O = w.shop.origin, T = h.THREE; h.explore(null); h.setPose({ pos: new T.Vector3(O.x - 6.5, 4.2, O.z + 6.8), look: new T.Vector3(O.x + 1.5, 3.4, O.z - 4.5), fov: 66 }); });
  await grab('wide');
  await p.evaluate(() => { const w = window.__journey.world, h = w.host, O = w.shop.origin, T = h.THREE; h.explore(null); h.setPose({ pos: new T.Vector3(O.x + 0.5, 1.6, O.z + 3.5), look: new T.Vector3(O.x - 0.5, 6.0, O.z - 6.0), fov: 70 }); });
  await grab('up');
  for (const id of ['train', 'teddy']) {
    await p.evaluate(async (id) => { const w = window.__journey.world; await w.shop.focus(id, { reducedMotion: true }); const h = w.host; for (let i = 0; i < 12; i++) h.frame(0.1); }, id);
    await grab('toy_' + id);
  }
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
  await b.close();
})();
