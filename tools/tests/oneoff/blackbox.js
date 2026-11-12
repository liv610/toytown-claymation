const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto('http://localhost:8765/journey/index.html?capture=1&q=high&variant=explore&look=textile', { timeout: 600000 });
  await p.waitForFunction(() => window.__journey.world.host && window.__journey.world.story, null, { timeout: 900000, polling: 1000 });
  const res = await p.evaluate(() => {
    const w = window.__journey.world, h = w.host, T = h.THREE, B = (x, y, z) => new T.Vector3(x, z, -y);
    h.setPaused(true); w.map.unmount(); w.story.reset();
    const pose = { pos: B(-8.5, -17.5, 9.5), look: B(2.0, 0.5, 1.6), fov: 50 };
    const probe = () => { h.setPose(pose); h.frame(1 / 60); h.frame(1 / 60); const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.drawImage(h.renderer.domElement, 0, 0, 1600, 900); const d = g.getImageData(400, 600, 1, 1).data; return d[0] + d[1] + d[2]; };
    const out = { base: probe() };
    const groups = { puppets: [], gift: [], dropbox: [] };
    h.scene.traverse((o) => { if (o.isMesh && /^puppet-/.test(o.name)) groups.puppets.push(o); });
    for (const [k, list] of Object.entries(groups)) { list.forEach((m) => (m.visible = false)); out[k + ' (' + list.length + ')'] = probe(); list.forEach((m) => (m.visible = true)); }
    // bloom off / bokeh off
    const passes = h.composer ? h.composer.passes : [];
    out.passes = passes.map((x) => x.constructor.name).join('|');
    for (const ps of passes) { if (/Bloom|Bokeh|GTAO/.test(ps.constructor.name)) { ps.enabled = false; out['no ' + ps.constructor.name] = probe(); ps.enabled = true; } }
    return out;
  });
  console.log(JSON.stringify(res, null, 0));
  await b.close();
})();
