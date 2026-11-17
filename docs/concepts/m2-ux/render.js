// Map renders for the Milestone 2 UX exploration (docs/concepts/m2-ux). Nothing in the app is changed: this drives the
// current national page (experiment/visitor-flow build) in a headless browser and saves the bare map canvas (no HTML
// interface). Test-only styles move the app's landing box so its own framing logic (campaign_focus.js freeArea) frames
// the campaign in the space each concept leaves open. Also saves frames of the existing descent (__nat.shot).
//   (cd web && npm run build:national && python3 -m http.server 8767)  then  URL=http://localhost:8767/national/index.html node render.js [prefix]
// SwiftShader (no GPU): the images are faithful renders of the current map; timings are not real-device numbers.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'renders'); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8767/national/index.html';
const dock = (top) => `#landing{top:${top}px!important;bottom:0!important;left:0!important;right:0!important;width:auto!important;max-height:none!important;opacity:0!important}`;
const hang = (h) => `#landing{top:0!important;bottom:auto!important;left:0!important;right:0!important;width:auto!important;height:${h}px!important;max-height:none!important;overflow:hidden!important;opacity:0!important}`;
const noBar = '.topbar{display:none!important}';
const R = [
  // Exploration A, direction A (map-first): the whole screen is map; a ticket docks at the bottom
  { name: 'pA_land', w: 390, h: 844, zoom: 0.5, target: [30, -10], el: 1.25, css: noBar + dock(900) },
  { name: 'pA_found', w: 390, h: 844, zip: '00201', css: noBar + dock(540) },
  { name: 'sA_land', w: 375, h: 667, zoom: 0.5, target: [30, -10], el: 1.25, css: noBar + dock(900) },
  // Exploration A, direction B (composed): a search header above, the map below it as the stage for Toy Town
  { name: 'pB_land', w: 390, h: 720, zoom: 0.36, target: [6, -4], el: 1.12, css: noBar + dock(900) },
  { name: 'pB_found', w: 390, h: 720, zip: '00201', css: noBar + hang(300) },
  { name: 'sB_land', w: 375, h: 560, zoom: 0.36, target: [6, -4], el: 1.12, css: noBar + dock(900) },
  // desktop: the landing map (for the transitions) and the descent frames
  { name: 'd_land', w: 1280, h: 720 },
  { name: 'd_found', w: 1280, h: 720, zip: '00201' },
  { name: 'd_descent', w: 1280, h: 720, shots: [0, 0.3, 0.55, 0.8, 1] },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const only = process.argv[2]; const af = path.join(OUT, 'anchors.json');
  const anchors = fs.existsSync(af) ? JSON.parse(fs.readFileSync(af)) : {};
  for (const r of R) {
    if (only && !r.name.startsWith(only)) continue;
    const p = await b.newPage({ viewport: { width: r.w, height: r.h }, deviceScaleFactor: 2, reducedMotion: 'reduce' }); p.setDefaultTimeout(300000);
    await p.goto(BASE + '?capture=1&q=high&maplehollow=1', { timeout: 300000 });
    if (r.css) await p.addStyleTag({ content: r.css });
    await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
    await p.evaluate(() => dispatchEvent(new Event('resize')));
    await p.waitForTimeout(1500);
    if (r.shots) {
      for (const u of r.shots) {
        const url = await p.evaluate((u) => window.__nat.shot(u), u);
        fs.writeFileSync(path.join(OUT, `${r.name}_${Math.round(u * 100)}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
        console.log(r.name, u);
      }
      await p.close(); continue;
    }
    if (r.zoom) {
      await p.evaluate(({ z, t, el }) => { const g = window.__nat.rig; g.dist *= z; if (t) g.target.set(t[0], 0, t[1]); if (el) g.el = el; }, { z: r.zoom, t: r.target || null, el: r.el || null });
      await p.waitForTimeout(6000);
    }
    if (r.zip) { await p.evaluate((z) => { document.getElementById('zip').value = z; document.querySelector('.finder-form').requestSubmit(); }, r.zip); await p.waitForSelector('.finder-card', { state: 'attached' }); }
    await p.waitForFunction(() => window.__nat.state().mode === 'national' && !window.__nat.state().flying, null, { timeout: 300000 });
    await p.waitForTimeout(1500);
    const c = await p.evaluate(() => window.__nat.campaign());
    const url = await p.evaluate(() => window.__nat.pose({ ...window.__nat.rig }));
    const g = await p.evaluate(() => ({ maple: window.__nat.project(-82.45, 40.45), toytown: window.__nat.project(-98.6, 39.3) }));
    fs.writeFileSync(path.join(OUT, r.name + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    anchors[r.name] = { w: r.w, h: r.h, toytown: g.toytown, maple: g.maple, campaign: c.selected ? { x: c.x, y: c.y } : null };
    console.log(r.name, JSON.stringify(anchors[r.name]));
    fs.writeFileSync(af, JSON.stringify(anchors, null, 1));
    await p.close();
  }
  await b.close();
})();
