// The national map page works before, and without, its 3D world (Milestone 1, step 1). Headless Chromium + SwiftShader.
//   node national_shell.js OUTDIR          (dev server on :8765, after `npm run build:national`; env URL to override)
// 1. ?map=off            the ways-to-help bar and dialogs work; the 3D chunk (three.js) is never requested
// 2. WebGL unavailable   the 3D map fails to start; the page says so and the actions still work
// 3. normal              actions work before the 3D map is ready; then the map comes up and drag, zoom, the descent into
//                        Chapter 1, skip, look around, replay and back to the map still work. Prints load timings (SwiftShader timings
//                        are not real-device numbers; the shell-vs-world gap is what matters). Runs the map at
//                        q=medium, like national_chapter1.js.
// Also checks a phone viewport (390×844) for scenario 1. Exits non-zero on any failure.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
let failed = 0; const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

async function page(b, { viewport = { width: 1280, height: 720 }, noWebGL = false, reducedMotion = 'no-preference' } = {}) {
  const p = await b.newPage({ viewport, reducedMotion });
  const log = { errors: [], uncaught: [], warnings: [], requests: [] };
  p.on('pageerror', (e) => { log.uncaught.push(e.message); log.errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); if (m.type() === 'warning') log.warnings.push(m.text()); });
  p.on('request', (r) => log.requests.push(r.url()));
  if (noWebGL) await p.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  return { p, log };
}
async function actionsWork(p, label) {
  for (const a of ['give', 'donate', 'request', 'campaign']) {
    await p.click(`[data-action="${a}"]`, { timeout: 5000 });
    const open = await p.isVisible('#notyet'), title = await p.textContent('#nyTitle');
    await p.click('#notyet [data-close]'); const closed = !(await p.isVisible('#notyet'));
    ok(open && title.trim().length > 0 && closed, `${label}: "${title.trim()}" opens its dialog and closes`);
  }
}
// a frame of the live 3D map (?capture=1 keeps the drawing buffer). Page screenshots of the running map stall under
// SwiftShader (the same on the build before this change), so the normal scenario grabs the canvas instead.
const canvasShot = async (p, path) => fs.writeFileSync(path, Buffer.from((await p.evaluate(() => document.querySelector('#stage canvas').toDataURL('image/jpeg', 0.85))).split(',')[1], 'base64'));
const worldChunk = (log) => log.requests.some((u) => /\/main-[A-Z0-9]+\.js/.test(u));

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // 1. map off, desktop and phone
  for (const [name, viewport] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]]) {
    const { p, log } = await page(b, { viewport });
    await p.goto(BASE + '?map=off'); const w = await p.evaluate(() => window.__natShell.world);
    ok(w === false, `map=off (${name}): world promise resolves false`);
    ok(/turned off/.test(await p.textContent('#status')), `map=off (${name}): page explains the map is off`);
    ok(!(await p.isVisible('#descend')), `map=off (${name}): no dead "Visit Maple Hollow" button`);
    await actionsWork(p, `map=off (${name})`);
    ok(!worldChunk(log) && !(await p.evaluate(() => !!window.__nat)), `map=off (${name}): 3D chunk never requested`);
    ok(log.errors.length === 0, `map=off (${name}): no page errors ${log.errors.join(' | ')}`);
    await p.screenshot({ path: `${out}/shell_mapoff_${name}.png`, timeout: 120000 }); await p.close();
  }

  // 2. WebGL unavailable
  {
    const { p, log } = await page(b, { noWebGL: true });
    await p.goto(BASE); const w = await p.evaluate(() => window.__natShell.world);
    ok(w === false, 'no WebGL: world promise resolves false');
    ok(/could not load/.test(await p.textContent('#status')), 'no WebGL: page explains the map could not load');
    await actionsWork(p, 'no WebGL');
    ok(log.uncaught.length === 0, `no WebGL: no uncaught page errors ${log.uncaught.join(' | ')}`);   // three.js itself logs "Error creating WebGL context"; the shell catches it
    await p.screenshot({ path: `${out}/shell_nowebgl.png`, timeout: 120000 }); await p.close();
  }

  // 3. normal: actions before the world, then the world and its controls. With prefers-reduced-motion, flights are
  // instant (SwiftShader draws ~0.5 frames/s, so the 7.5 s descent would take many minutes; same on the old build).
  {
    const { p, log } = await page(b, { reducedMotion: 'reduce' });
    const t0 = Date.now();
    await p.goto(BASE + '?capture=1&q=medium', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__natShell);
    const tShell = Date.now() - t0, early = await p.evaluate(() => !window.__nat);
    await p.click('[data-action="campaign"]'); const open = await p.isVisible('#notyet'); await p.click('#notyet [data-close]');
    ok(early && open, `normal: "Find Local Campaign" works ${tShell} ms after navigation, before the 3D map is ready`);
    const w = await p.evaluate(() => window.__natShell.world, null); const tWorld = Date.now() - t0;
    ok(w === true && await p.evaluate(() => !!window.__nat), `normal: 3D map ready after ${tWorld} ms (SwiftShader)`);
    ok(await p.isVisible('#descend') && !(await p.$('#status')), 'normal: "Visit Maple Hollow" shown, loading message gone');
    await p.waitForTimeout(1500);
    ok(await p.isVisible('#pinMaple'), 'normal: Maple Hollow pin visible on the country view');
    await canvasShot(p, `${out}/shell_normal_country.jpg`);
    await actionsWork(p, 'normal (map running)');
    // drag pans, wheel zooms
    const r0 = await p.evaluate(() => ({ ...window.__nat.rig }));
    await p.mouse.move(640, 420); await p.mouse.down(); await p.mouse.move(560, 380, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(400);
    const r1 = await p.evaluate(() => ({ ...window.__nat.rig }));
    ok(JSON.stringify(r0) !== JSON.stringify(r1), 'normal: dragging moves the map');
    await p.mouse.wheel(0, -600); await p.waitForTimeout(600);
    const r2 = await p.evaluate(() => ({ ...window.__nat.rig }));
    ok(r2.dist < r1.dist, `normal: wheel zooms in (dist ${r1.dist.toFixed(1)} → ${r2.dist.toFixed(1)})`);
    // descent → Chapter 1 → skip → end card → look around (town) → play Chapter 1 again → skip → back to the map
    const mode = (m) => p.waitForFunction((m) => window.__nat.state().mode === m, m, { timeout: 300000, polling: 250 });
    await p.click('#descend'); await mode('story'); ok(await p.isVisible('#storybar'), 'normal: descent lands in Chapter 1 with its story controls');
    await p.click('[data-action="request"]'); const dlg = await p.isVisible('#notyet'); await p.click('#notyet [data-close]');
    ok(dlg, 'normal: "Request Toys" still opens during the story');
    await p.click('#sSkip'); await p.waitForSelector('#endcard:not([hidden])', { timeout: 30000 }); ok(true, 'normal: Skip shows the end card');
    await p.click('#eLook'); await mode('town');
    ok(await p.isVisible('#playCh1') && await p.isVisible('#ascend'), 'normal: "Look around" leaves the story in Maple Hollow with its controls');
    await canvasShot(p, `${out}/shell_normal_town.jpg`);
    await p.click('#playCh1'); await mode('story'); ok(true, 'normal: "Play Chapter 1" starts the story again');
    await p.click('#sSkip'); await p.waitForSelector('#endcard:not([hidden])', { timeout: 30000 });
    await p.click('#eMap'); await mode('national'); ok(await p.isVisible('#descend'), 'normal: "Back to the map" returns to the national map');
    ok(log.errors.length === 0, `normal: no page errors ${log.errors.join(' | ')}`);
    console.log(`timings: shell interactive ${tShell} ms, 3D map ready ${tWorld} ms (SwiftShader, not real-device numbers)`);
    await p.close();
  }
  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
