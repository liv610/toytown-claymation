// QUICK review: a few targeted frames of the Chapter 2 scene, from the named views in
// web/national/src/review_views.json (the same views the dev panel offers). One browser, one page load per size, only
// the frames asked for: a small change is checked in minutes, not with the whole screenshot library.
//
//   node tools/tests/review_shots.js OUTDIR lid                 a group (lid, hall, door) or view names
//   node tools/tests/review_shots.js OUTDIR hall-front lid-open-side
//   SIZE=phone|desktop,phone   (default desktop)     URL=…/national/index.html   (default http://localhost:8765/…)
//   VIEW='name|at|px,py,pz|lx,ly,lz; name2|…'   ad hoc views (at: seconds or a timeline mark like lidGo+0.8; town units)
//
// Writes OUTDIR/<view>_<size>.jpg, a labelled contact sheet OUTDIR/sheet_<size>.jpg (ImageMagick, if installed) and
// prints the dev-panel link for each view, to follow up interactively.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const [out = 'review', ...names] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 844 } };
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, '../../web/national/src/review_views.json'), 'utf8'));

const views = [];
for (const n of names) {
  const list = CFG.groups[n] || [n];
  for (const v of list) { if (!CFG.views[v]) { console.error(`unknown view or group "${v}". Views: ${Object.keys(CFG.views).join(', ')}; groups: ${Object.keys(CFG.groups).join(', ')}`); process.exit(2); } views.push([v, CFG.views[v]]); }
}
for (const v of (process.env.VIEW || '').split(';').filter((x) => x.trim())) {   // several ad hoc views: separate them with ;
  const [name, at, p, l] = v.trim().split('|');
  views.push([name, { at, pos: p.split(',').map(Number), look: l.split(',').map(Number) }]);
}
if (!views.length) { console.error('name at least one view or group, or set VIEW'); process.exit(2); }

(async () => {
  const t0 = Date.now();
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const size of (process.env.SIZE || 'desktop').split(',')) {
    const p = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: 1 }); p.setDefaultTimeout(600000);
    const errors = []; p.on('pageerror', (e) => { errors.push(e.message); console.error('page error:', e.message); });
    p.on('console', (m) => { if (m.type() === 'warning' && /unavailable/.test(m.text())) console.error('page warning:', m.text()); });   // the 3D map failing falls back quietly   // shown at once: a scene that fails to build would otherwise only time out
    await p.goto(BASE + '?capture=1&q=medium', { timeout: 600000 });
    await p.waitForFunction(() => window.__nat && window.__nat.s2 && window.__nat.s2(), null, { timeout: 600000, polling: 500 });
    const T = await p.evaluate(() => window.__nat.sceneTimes());
    const files = [];
    for (const [name, v] of views) {
      const t = typeof v.at === 'number' || !isNaN(+v.at) ? +v.at : (() => { const m = /^(\w+)\s*([+-][\d.]+)?$/.exec(v.at); if (!m || !(m[1] in T)) throw new Error(`view ${name}: unknown moment "${v.at}"`); return T[m[1]] + (m[2] ? +m[2] : 0); })();
      const url = v.camera === 'story' ? await p.evaluate((t) => window.__nat.sceneFrame(t), t)
        : await p.evaluate(([t, pos, look]) => window.__nat.sceneLook(t, pos, look), [t, v.pos, v.look]);
      const f = path.join(out, `${name}_${size}.jpg`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push([f, `${name} · ${t.toFixed(2)} s`]);
      const q = new URLSearchParams({ dev: '1', ...(CFG.views[name] ? { view: name } : { t: t.toFixed(3) }), ...(size === 'phone' ? { frame: 'phone' } : {}) });
      console.log(`${f}   ${v.note || ''}\n    dev link: ${BASE}?${q}`);
    }
    if (errors.length) console.log('page errors:', errors.join(' | '));
    await p.close();
    try {
      const sheet = path.join(out, `sheet_${size}.jpg`), w = size === 'phone' ? 260 : 640, h = size === 'phone' ? 563 : 360;
      execFileSync('montage', [...files.flatMap(([f, l]) => ['-label', l, f]), '-tile', `${Math.min(files.length, size === 'phone' ? 4 : 2)}x`, '-geometry', `${w}x${h}+4+4`, '-pointsize', '14', '-background', '#222', '-fill', '#eee', sheet]);
      console.log('sheet:', sheet);
    } catch { /* no ImageMagick: the single frames are enough */ }
  }
  await b.close();
  console.log(`${views.length} view(s) in ${((Date.now() - t0) / 1000).toFixed(0)} s (SwiftShader; much faster with a GPU)`);
})();
