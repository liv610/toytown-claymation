// ZIP search → the felt map (Milestone 1, step 3, first part). Headless Chromium + SwiftShader (no GPU: about one frame
// every 2 s, so timings here are not real-device numbers). Dev server on :8765 after `npm run build:national`.
//   node tools/tests/finder_map.js OUTDIR
// 1. desktop 1280×720, reduced motion: card at once, one shared selection, camera framed in the open area beside the
//    finder, pin shown; Back clears it; a second search moves to the new campaign
// 2. desktop, full motion: the card and its website link work while the camera is still moving
// 3. other sizes: 1100×720 (where the finder used to cover the Maple Hollow pin), tablet 900×1000, phone 390×844
//    (card covers the map → "See it on the map" → the pill brings the same card back)
// 4. chosen before the map has loaded → framed when it arrives
// 5. during the story: the card works, the camera does not move, no pin
// 6. map off: selection and card work, no map-only buttons
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };

async function open(b, query, { viewport = { width: 1280, height: 720 }, reducedMotion = 'reduce', waitMap = true, holdMap = null } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion });
  if (holdMap) await ctx.route(/\/main-[A-Z0-9]+\.js/, async (r) => { await holdMap; r.continue(); });   // keep the 3D map back until released
  await ctx.route(/example\.org|toysfortots\.org/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outbound</title>' }));
  const p = await ctx.newPage(); const errors = []; p.setDefaultTimeout(120000);   // SwiftShader can stall the page for a while mid-flight
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + '?' + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__natShell); await p.waitForSelector('.finder-test:not([hidden])');
  if (waitMap) await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
  return { ctx, p, errors };
}
async function search(p, zip) {
  await p.fill('#zip', zip); await p.click('.finder-form [type="submit"]');
  await p.waitForFunction((z) => { const h = document.querySelector('.finder-out h3'); return h && h.textContent.includes(z); }, zip, { timeout: 120000 });
}
const settle = (p) => p.waitForFunction(() => window.__nat.state().mode === 'national', null, { timeout: 300000, polling: 250 });
const pinState = (p) => p.evaluate(() => window.__nat.campaign());
const sel = (p) => p.evaluate(() => { const s = window.__natShell.selection.get(); return s && { id: s.id, via: s.via, zip: s.zip, kind: s.kind }; });
const inArea = (s) => s.x >= s.area.left && s.x <= s.area.right && s.y >= s.area.top && s.y <= s.area.bottom;
const underFinder = (p, s) => p.evaluate(({ x, y }) => { const f = document.getElementById('finder'); if (f.hidden) return false; const r = f.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }, s);
// a posed still: __nat.pose() stops the map's animation loop, so take it only after the last check that needs the map moving
const still = async (p, path) => { const u = await p.evaluate(() => window.__nat.pose({ ...window.__nat.rig })); await p.screenshot({ path, timeout: 300000 }); return u; };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ------------------------------------------------------------ 1. desktop, reduced motion
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium');
    const dist0 = await p.evaluate(() => window.__nat.rig.dist);
    ok((await pinState(p)).selected === false, '1: no campaign selected on arrival, no pin');
    await search(p, '00101');
    await p.click('.finder-row-btn >> nth=0');
    ok(await p.$('.finder-card') !== null, '1: the card is there as soon as the click is handled (no waiting for the map)');
    ok(JSON.stringify(await sel(p)) === JSON.stringify({ id: 'test-maple-hollow', via: 'search', zip: '00101', kind: 'serving' }), '1: one shared selection: Maple Hollow Toy Drive, via search, serving 00101');
    await settle(p); await p.waitForTimeout(600);
    let s = await pinState(p);
    ok(s.visible && inArea(s) && !(await underFinder(p, s)), `1: pin shown at (${Math.round(s.x)}, ${Math.round(s.y)}), inside the open area (x ${Math.round(s.area.left)}–${Math.round(s.area.right)}), not under the finder`);
    ok(Math.abs(s.x - (s.area.left + s.area.right) / 2) < 30 && Math.abs(s.y - (s.area.top + s.area.bottom) / 2) < 30, '1: framed at the centre of the open area');
    ok(await p.evaluate(() => window.__nat.rig.dist) < dist0 * 0.6, '1: the camera moved in from the country view to the region');
    await p.click('.finder-back');
    s = await pinState(p);
    ok(await sel(p) === null && s.selected === false && (await p.$('.finder-card')) === null, '1: "Back to results" clears the selection: card closed, pin gone');
    await search(p, '00201'); await p.click('.finder-row-btn >> nth=0'); await settle(p); await p.waitForTimeout(600);
    s = await pinState(p);
    ok((await sel(p)).id === 'test-copper-wash' && s.visible && inArea(s) && !(await underFinder(p, s)), '1: a new search and selection (Copper Wash, Arizona) moves the map and the pin there');
    await still(p, `${out}/1_desktop_arizona.png`);
    await p.click('.finder-row-btn >> nth=0').catch(() => {});
    await p.keyboard.press('Escape');
    ok(await sel(p) === null, '1: Escape on the card clears the selection too');
    await search(p, '00105');
    await p.focus('.finder-row-btn >> nth=1'); await p.keyboard.press('Enter');
    ok((await sel(p)).id === 'test-lanternfield' && await p.evaluate(() => document.activeElement.id === 'finderCardName'), '1: keyboard: Enter on a result selects it and moves focus to the card heading');
    ok(errors.length === 0, '1: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ 2. desktop, full motion: nothing waits for the camera
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium', { reducedMotion: 'no-preference' });
    await search(p, '00103'); await p.click('.finder-row-btn >> nth=1');
    const flying = await p.evaluate(() => window.__nat.state().mode);
    ok(flying === 'flying' && await p.$('.finder-card') !== null, '2: card shown while the camera is still flying');
    const [popup] = await Promise.all([ctx.waitForEvent('page'), p.click('a.finder-site')]);
    ok(popup.url() === 'https://example.org/test-campaigns/lanternfield' && await p.evaluate(() => window.__nat.state().mode) === 'flying', '2: the website link opens mid-flight');
    await popup.close();
    await p.click('.finder-back');
    ok(await sel(p) === null, '2: Back works mid-flight');
    await settle(p);
    ok(await p.evaluate(() => window.__nat.state().mode) === 'national', '2: the camera lands and the map is back under the visitor’s control');
    ok(errors.length === 0, '2: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ 3. other sizes
  for (const [name, viewport] of [['desktop-1100', { width: 1100, height: 720 }], ['tablet', { width: 900, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium', { viewport });
    await search(p, '00101'); await p.click('.finder-row-btn >> nth=0'); await settle(p); await p.waitForTimeout(600);
    let s = await pinState(p);
    if (name !== 'phone') {
      ok(s.visible && !s.area.covered && inArea(s) && !(await underFinder(p, s)), `3 ${name}: pin in the open area (${Math.round(s.x)}, ${Math.round(s.y)}), not under the finder`);
      ok(!(await p.isVisible('.finder-seemap')) || name === 'tablet', `3 ${name}: "See it on the map" only where the finder spans the screen`);
      await still(p, `${out}/3_${name}.png`);
    } else {
      ok(s.area.covered && await p.isVisible('.finder-seemap'), '3 phone: the card covers most of the map, so the card offers "See it on the map"');
      await p.click('.finder-seemap'); await settle(p); await p.waitForTimeout(600);
      s = await pinState(p);
      ok(!(await p.isVisible('#finder')) && await p.textContent('#finderPill') === 'Show: Maple Hollow Toy Drive' && await p.evaluate(() => document.activeElement.id === 'finderPill'), '3 phone: the finder tucks away; the pill reads "Show: Maple Hollow Toy Drive" and has focus');
      ok(s.visible && inArea(s) && !s.area.covered, `3 phone: the pin is on screen in the open map (${Math.round(s.x)}, ${Math.round(s.y)})`);
      await still(p, `${out}/3_phone_map.png`);
      await p.click('#finderPill');
      ok(await p.isVisible('.finder-card') && /Maple Hollow Toy Drive/.test(await p.textContent('.finder-card')) && (await sel(p)).id === 'test-maple-hollow', '3 phone: the pill brings the same card back without a new search');
      ok(await p.isVisible('a.finder-site'), '3 phone: the website link is right there');
    }
    ok(errors.length === 0, `3 ${name}: no page errors ` + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ 4. chosen before the map loads
  {
    let release; const held = new Promise((r) => { release = r; });
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium', { waitMap: false, holdMap: held });
    await search(p, '00104'); await p.click('.finder-row-btn >> nth=0');
    const early = await p.evaluate(() => !window.__nat);
    release();
    ok(early && await p.$('.finder-card') !== null, '4: a campaign chosen before the 3D map is ready shows its card');
    await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 }); await settle(p); await p.waitForTimeout(600);
    const s = await pinState(p);
    ok(s.visible && inArea(s) && !(await underFinder(p, s)), '4: when the map arrives it frames that campaign (Sparrow Creek) and shows the pin');
    ok(errors.length === 0, '4: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ 5. during the story
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium');
    await p.click('#descend');
    await p.waitForFunction(() => window.__nat.state().mode === 'story', null, { timeout: 300000, polling: 250 });
    const rig0 = await p.evaluate(() => JSON.stringify(window.__nat.rig));
    await p.click('#finderPill'); await search(p, '00105'); await p.click('.finder-row-btn >> nth=1');
    await p.waitForTimeout(1500);
    const s = await pinState(p);
    ok(await p.isVisible('.finder-card') && await p.evaluate(() => window.__nat.state().mode) === 'story' && s.visible === false, '5: in the story the card opens, the story stays, no pin');
    ok(await p.isVisible('#storybar'), '5: story controls still there');
    ok(rig0 !== '' && errors.length === 0, '5: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ 6. map off
  {
    const { ctx, p, errors } = await open(b, 'map=off', { waitMap: false });
    await search(p, '00101'); await p.click('.finder-row-btn >> nth=0');
    ok((await sel(p)).id === 'test-maple-hollow' && await p.isVisible('.finder-card') && !(await p.isVisible('.finder-seemap')), '6: map off: selecting works, the card shows, no "See it on the map"');
    await p.click('.finder-back'); ok(await sel(p) === null, '6: map off: Back clears the selection');
    ok(errors.length === 0, '6: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
