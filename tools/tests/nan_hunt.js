// Find what writes NaN/Inf pixels (they turn into black blocks once bloom spreads them): renders a pose into a
// float target, counts bad pixels, then bisects over the scene's top-level objects and materials.
//   node nan_hunt.js [query]      env POSE='px,py,pz,lx,ly,lz,fov' (three.js coordinates; default: the descent frame)
const { chromium } = require('playwright');
const qs = process.argv[2] || 'look=felt';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/journey/index.html?capture=1&q=high&variant=explore&' + qs, { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  const r = await p.evaluate((poseStr) => {
    const w = window.__journey.world, h = w.host, T = h.THREE; h.setPaused(true); w.map.unmount();
    const a = (poseStr || '10,11,33,1.5,3.2,4,50').split(',').map(Number);
    h.setPose({ pos: new T.Vector3(a[0], a[1], a[2]), look: new T.Vector3(a[3], a[4], a[5]), fov: a[6] });
    h.frame(1 / 60);
    const rt = new T.WebGLRenderTarget(320, 180, { type: T.FloatType });
    const buf = new Float32Array(320 * 180 * 4);
    const bad = () => {
      h.renderer.setRenderTarget(rt); h.renderer.render(h.scene, h.camera); h.renderer.setRenderTarget(null);
      h.renderer.readRenderTargetPixels(rt, 0, 0, 320, 180, buf);
      let n = 0; for (let i = 0; i < buf.length; i += 4) if (!Number.isFinite(buf[i] + buf[i + 1] + buf[i + 2])) n++; return n;
    };
    const out = { all: bad() };
    if (!out.all) return out;
    // which top-level children
    const kids = h.scene.children.filter((o) => o.visible);
    out.byChild = [];
    for (const o of kids) { o.visible = false; const n = bad(); o.visible = true; if (n < out.all) out.byChild.push([o.name || o.type, o.children.length, out.all - n]); }
    // which meshes, by material name, among the worst child
    const meshes = []; h.scene.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
    const byMat = {}; for (const m of meshes) { const k = (Array.isArray(m.material) ? m.material[0] : m.material).name || '?'; (byMat[k] = byMat[k] || []).push(m); }
    out.byMat = [];
    for (const [k, ms] of Object.entries(byMat)) { ms.forEach((m) => (m.visible = false)); const n = bad(); ms.forEach((m) => (m.visible = true)); if (n < out.all) out.byMat.push([k, ms.length, out.all - n]); }
    return out;
  }, process.env.POSE);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
