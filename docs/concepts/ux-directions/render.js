// Map renders for the two UX direction concepts (docs/concepts/ux-directions). Nothing in the app is changed: this
// drives the current national page in a headless browser and saves the bare map canvas (no HTML interface), with test
// styles injected into that browser only so the app's own framing logic sees each concept's panel sizes.
//   (cd web && npm run build:national && python3 -m http.server 8765)  then  node docs/concepts/ux-directions/render.js
// Writes renders/<name>.jpg and renders/anchors.json (where the Maple Hollow / Toy Town labels and the campaign pin sit).
// SwiftShader (no GPU): the images are faithful, timings are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'renders'); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';

// the finder is moved off screen (it still works) and the help bar / top bar stand in for each concept's panels, so
// freeArea() (campaign_focus.js) frames the campaign in the space each concept leaves open
const offFinder = '#finder{top:-3000px!important;bottom:auto!important}';
const bar = (h) => `.topbar{height:${h}px!important;overflow:hidden!important;padding-top:0!important;padding-bottom:0!important}`;
const noBar = '.topbar{display:none!important}';
const bottomEdge = (y) => `.actions{position:fixed!important;display:block!important;top:${y + 64}px!important;bottom:auto!important;left:0!important;right:0!important;height:12px!important}`;
const R = [
  // Direction A, map-first: the map is the whole page; a small search pill, then a result card where the pill was
  { name: 'A_desktop_landing', w: 1280, h: 720 },
  { name: 'A_desktop_found', w: 1280, h: 720, zip: '00201', css: '#finder{top:84px!important;right:20px!important;width:340px!important;height:250px!important;max-height:none!important;overflow:hidden!important}' },
  { name: 'A_phone_landing', w: 390, h: 844 },
  { name: 'A_phone_found', w: 390, h: 844, zip: '00201', css: offFinder + bar(52) + bottomEdge(548) },      // result sheet from y 556
  { name: 'A_phone_details', w: 390, h: 844, zip: '00201', css: offFinder + bar(52) + bottomEdge(318) },    // expanded sheet from y 326
  // Direction B, integrated: the map is a region of the page beside / above a docked panel (rendered at that size)
  { name: 'B_desktop_landing', w: 920, h: 656, css: noBar + offFinder },
  { name: 'B_desktop_found', w: 920, h: 656, zip: '00201', css: noBar + offFinder },
  { name: 'B_phone_landing', w: 390, h: 430, css: noBar + offFinder },
  { name: 'B_phone_found', w: 390, h: 380, zip: '00201', css: noBar + offFinder },
  { name: 'B_phone_details', w: 390, h: 236, zip: '00201', css: noBar + offFinder },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const only = process.argv[2]; const anchors = fs.existsSync(path.join(OUT, 'anchors.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'anchors.json'))) : {};
  for (const r of R) {
    if (only && !r.name.startsWith(only)) continue;
    const p = await b.newPage({ viewport: { width: r.w, height: r.h }, deviceScaleFactor: 2, reducedMotion: 'reduce' }); p.setDefaultTimeout(300000);
    await p.goto(BASE + '?capture=1&q=high', { timeout: 300000 });
    if (r.css) await p.addStyleTag({ content: r.css });
    await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
    await p.evaluate(() => dispatchEvent(new Event('resize')));
    await p.waitForTimeout(1500);
    if (r.zip) { await p.fill('#zip', r.zip); await p.click('.finder-form [type=submit]'); await p.waitForSelector('.finder-card'); }
    await p.waitForFunction(() => window.__nat.state().mode === 'national' && !window.__nat.state().flying, null, { timeout: 300000 });
    await p.waitForTimeout(1500);
    const a = await p.evaluate(() => {
      const at = (id) => { const e = document.getElementById(id); if (e.hidden) return null; const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.bottom }; };
      const c = window.__nat.campaign();
      return { maple: at('pinMaple'), toytown: at('pinToy'), campaign: c.selected ? { x: c.x, y: c.y } : null, area: c.area || null };
    });
    const url = await p.evaluate(() => window.__nat.pose({ ...window.__nat.rig }));
    fs.writeFileSync(path.join(OUT, r.name + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    anchors[r.name] = { w: r.w, h: r.h, ...a };
    console.log(r.name, JSON.stringify(anchors[r.name]));
    await p.close();
  }
  fs.writeFileSync(path.join(OUT, 'anchors.json'), JSON.stringify(anchors, null, 1));
  await b.close();
})();
