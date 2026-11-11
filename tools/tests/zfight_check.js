// Flicker (z-fighting) check: render each view twice with the camera nudged by ~1 mm and time frozen, then count
// pixels that change sharply. Coplanar surfaces swap winners under tiny moves and show up as speckle; a clean view
// changes almost nothing. Snow and the falling-snow sprites are hidden for the comparison.
//   node zfight_check.js OUTDIR [look]      (look: felt | textile | clay, default felt)
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2], look = process.argv[3] || 'felt'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`http://localhost:8765/journey/index.html?q=low&capture=1&variant=explore&look=${look}`, { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  await p.evaluate(() => { const w = window.__journey.world; w.host.setPaused(true); w.map.unmount(); w.story.reset(); w.host.scene.traverse((o) => { if (o.isPoints) o.visible = false; }); });
  const views = (process.env.VIEWS || 'overview,window,street,tree').split(',');
  const res = {};
  for (const v of views) {
    const r = await p.evaluate(async (v) => {
      const w = window.__journey.world, h = w.host, T = h.THREE;
      const pose = (h.poses && h.poses[v]) || w.village.poses[v];
      const grab = (dx) => { h.setPose({ pos: pose.pos.clone().add(new T.Vector3(dx, dx * 0.5, 0)), look: pose.look.clone(), fov: pose.fov });
        for (let i = 0; i < 4; i++) h.frame(0);   // dt = 0: nothing animates, the crossfade has settled
        const c = h.renderer.domElement, x = document.createElement('canvas'); x.width = c.width; x.height = c.height; x.getContext('2d').drawImage(c, 0, 0);
        return { d: x.getContext('2d').getImageData(0, 0, x.width, x.height).data, url: x.toDataURL('image/jpeg', 0.85) }; };
      // make sure the felt street is fully in (the crossfade advances with time)
      for (let i = 0; i < 40; i++) { h.setPose(pose); h.frame(0.1); }
      const a = grab(0), b2 = grab(0.001);
      let n = 0, total = a.d.length / 4;
      const c = h.renderer.domElement, m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const mg = m.getContext('2d'), md = mg.createImageData(c.width, c.height);
      for (let i = 0; i < a.d.length; i += 4) { const dd = Math.abs(a.d[i] - b2.d[i]) + Math.abs(a.d[i + 1] - b2.d[i + 1]) + Math.abs(a.d[i + 2] - b2.d[i + 2]); const hit = dd > 90; if (hit) n++;
        md.data[i] = hit ? 255 : a.d[i] * 0.35; md.data[i + 1] = hit ? 30 : a.d[i + 1] * 0.35; md.data[i + 2] = hit ? 30 : a.d[i + 2] * 0.35; md.data[i + 3] = 255; }
      mg.putImageData(md, 0, 0);
      return { frac: n / total, url: a.url, mask: m.toDataURL('image/png') };
    }, v);
    fs.writeFileSync(`${out}/${v}.jpg`, Buffer.from(r.url.split(',')[1], 'base64'));
    fs.writeFileSync(`${out}/${v}_changes.png`, Buffer.from(r.mask.split(',')[1], 'base64'));   // red = pixels that jumped
    res[v] = +(r.frac * 100).toFixed(3);
    console.log(v, res[v] + '% of pixels jump');
  }
  fs.writeFileSync(`${out}/zfight.json`, JSON.stringify(res, null, 1));
  await b.close();
})();
