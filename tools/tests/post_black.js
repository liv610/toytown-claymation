// Which post-processing pass turns a pose's frame black (NaN spread)? Renders the composer with each pass toggled
// off in turn and counts pure-black pixels. env POSE='px,py,pz,lx,ly,lz,fov' (three.js coordinates).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.env.W || 640), height: +(process.env.H || 360) } });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore&' + (process.argv[2] || 'look=felt'), { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  const r = await p.evaluate((poseStr) => {
    const w = window.__journey.world, h = w.host, T = h.THREE; h.setPaused(true); w.map.unmount();
    const a = poseStr.split(',').map(Number);
    h.setPose({ pos: new T.Vector3(a[0], a[1], a[2]), look: new T.Vector3(a[3], a[4], a[5]), fov: a[6] });
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const g = cv.getContext('2d');
    const black = () => { h.frame(1 / 60); h.frame(1 / 60); g.drawImage(h.renderer.domElement, 0, 0, 320, 180); const d = g.getImageData(0, 0, 320, 180).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 3) n++; return n; };
    const out = { all: black(), passes: {} };
    for (const ps of h.composer.passes) { const was = ps.enabled; ps.enabled = false; out.passes[ps.constructor.name] = black(); ps.enabled = was; }
    out.cam = { near: h.camera.near, far: h.camera.far };
    return out;
  }, process.env.POSE);
  console.log(JSON.stringify(r));
  await b.close();
})();
