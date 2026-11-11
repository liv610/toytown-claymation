// Handmade style test: the comparison split and the interactions (door, lamp, tree), headless.
//   node tools/tests/handmade_interact.js OUTDIR
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/handmade/index.html?capture=1&dpr=1&style=split&along=0.12');
  await p.waitForFunction(() => window.__ready, null, { timeout: 600000, polling: 500 });
  const shot = async (name, fn) => { const url = await p.evaluate(fn); fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log(name); };
  await shot('split_hero', async () => { window.__hm.goCam('Hero', true); return window.__hm.still(4); });
  await shot('split_close_door', async () => { window.__hm.act('door'); window.__hm.goCam('Close', true); window.__hm.setSplit(0.42); return window.__hm.still(4); });
  await shot('split_lamp_off', async () => { window.__hm.act('lamp'); window.__hm.goCam('Street', true); window.__hm.setSplit(0.5); return window.__hm.still(4.2); });
  await shot('split_marine', async () => { window.__hm.act('lamp'); window.__hm.goCam('Marine', true); return window.__hm.still(4); });
  // a real click on the door through the page (raycast path), single style
  const at = await p.evaluate(async () => { await window.__hm.setMode('paper'); window.__hm.goCam('Close', true); window.__hm.still(4);
    const box = new window.__hm.camera.position.constructor(); const door = window.__hm.styles.paper.clickables[0].objects[0];
    door.geometry.computeBoundingBox(); door.geometry.boundingBox.getCenter(box); door.localToWorld(box); box.project(window.__hm.camera);
    return [(box.x + 1) / 2 * innerWidth, (1 - box.y) / 2 * innerHeight]; });
  const before = await p.evaluate(() => window.__hm.styles.paper.clickables[0].objects[0].parent.rotation.y);
  await p.mouse.move(at[0], at[1]); await p.mouse.down(); await p.mouse.up();
  const after = await p.evaluate(() => { window.__hm.still(4); return window.__hm.styles.paper.clickables[0].objects[0].parent.rotation.y; });
  console.log('door rotation before/after a real click at', at.map(Math.round).join(','), ':', before.toFixed(2), '→', after.toFixed(2), after !== before ? 'OK' : 'FAILED');
  const st = await p.evaluate(async () => { const out = {}; for (const m of ['paper', 'felt']) { await window.__hm.setMode(m); window.__hm.goCam('Hero', true); window.__hm.still(4); out[m] = window.__hm.stats(); } return out; });
  console.log('frame stats (whole frame incl. shadows + post):', JSON.stringify(st));
  await b.close();
})();
