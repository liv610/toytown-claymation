// Browsing campaigns by state (Milestone 1, step 3, stage 1). Headless Chromium + SwiftShader (no GPU: about one frame
// every 2 s; timings are not real-device numbers). Dev server on :8765 after `npm run build:national`.
//   node tools/tests/finder_states.js OUTDIR
// A. map off: the state list, the state's campaigns, filter, card and Back, empty states, ZIP search clearing it,
//    keyboard use (typing a state name keeps focus on the list), phone size
// B. map on (desktop, reduced motion): a drag is not a click; a click on the land browses that state (outline, framing,
//    finder list with focus); the ocean does nothing; Arizona; a campaign from the list (pin, Back to the list); Alaska
//    on the felt board's inset; the state list driving the map; a ZIP search clearing it all
// C. the existing Maple Hollow pin still starts the descent; clicks in the story do not browse
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };

async function open(b, query, { viewport = { width: 1280, height: 720 }, waitMap = true } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion: 'reduce' });
  await ctx.route(/example\.org|toysfortots\.org/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outbound</title>' }));
  const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + '?' + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__natShell); await p.waitForSelector('.finder-test:not([hidden])');
  if (waitMap) { await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 }); await p.waitForTimeout(1500); }
  return { ctx, p, errors };
}
const region = (p) => p.evaluate(() => window.__natShell.selection.region());
const sel = (p) => p.evaluate(() => { const s = window.__natShell.selection.get(); return s && { id: s.id, via: s.via }; });
const heading = (p) => p.evaluate(() => { const h = document.querySelector('.finder-out h3'); return h && h.firstChild.textContent; });
const rows = (p) => p.$$eval('.finder-out .finder-list li:not([hidden]) .finder-row-name', (n) => n.map((x) => x.textContent));
const focusIs = (p, test) => p.evaluate(test);
const settle = (p) => p.waitForFunction(() => window.__nat.state().mode === 'national', null, { timeout: 300000, polling: 250 });
// click the first of these points that is open map (not under a label pin or the finder) and inside the state
async function clickAt(p, ...pts) {
  for (const [lon, lat] of pts) {
    const at = await p.evaluate(([lo, la]) => window.__nat.project(lo, la), [lon, lat]);
    if (!at || at.x < 0 || at.y < 0 || at.x > innerW || at.y > innerH) continue;
    const under = await p.evaluate(({ x, y }) => document.elementFromPoint(x, y).tagName, at);
    if (under !== 'CANVAS') continue;
    await p.mouse.click(at.x, at.y); return { ...at, under };
  }
  return { under: 'none', state: null };
}
let innerW = 1280, innerH = 720;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ------------------------------------------------------------ A. map off
  {
    const { ctx, p, errors } = await open(b, 'map=off', { waitMap: false });
    ok(await p.isVisible('#stateSel') && await p.$eval('label[for="stateSel"]', (l) => l.textContent) === 'Or browse by state', 'A: "Or browse by state" list is on the landing panel, labelled');
    ok(await p.$$eval('#stateSel option', (o) => o.length) === 52, 'A: it lists the 50 states and DC (plus "Choose a state…")');
    await p.selectOption('#stateSel', 'OH');
    ok((await region(p)).code === 'OH' && (await region(p)).via === 'list' && await heading(p) === 'Ohio', 'A: choosing Ohio browses it and shows its heading');
    ok((await rows(p)).join() === 'Lanternfield Toy Collection,Maple Hollow Toy Drive,Sparrow Creek Holiday Toy Drive' && /3 campaigns based in Ohio \(test data\)/.test(await p.textContent('.finder-count')), 'A: Ohio lists its 3 active campaigns by name (inactive Bramblewood left out)');
    ok(await sel(p) === null, 'A: browsing a state does not select any campaign');
    ok(/Listed by where each campaign is based/.test(await p.textContent('.finder-out')), 'A: says the list is by where campaigns are based, and points to ZIP search for an address');
    await p.waitForFunction(() => document.querySelector('.finder-live').textContent === 'Ohio: 3 campaigns.');
    ok(true, 'A: screen readers hear "Ohio: 3 campaigns."');
    await p.fill('#stateFilter', 'spar');
    ok((await rows(p)).join() === 'Sparrow Creek Holiday Toy Drive' && await p.textContent('.finder-count') === 'Showing 1 of 3 campaigns in Ohio.', 'A: the filter narrows the list ("spar" → 1 of 3)');
    await p.fill('#stateFilter', ''); ok((await rows(p)).length === 3, 'A: clearing the filter shows all 3 again');
    await p.screenshot({ path: `${out}/A_ohio.png` });
    await p.click('.finder-row-btn >> nth=1');
    ok((await sel(p)).id === 'test-maple-hollow' && (await sel(p)).via === 'state' && await p.textContent('.finder-back') === '← Back to Ohio', 'A: a campaign opens the shared card (via state); Back says "Back to Ohio"');
    await p.click('.finder-back');
    ok(await heading(p) === 'Ohio' && await sel(p) === null && await focusIs(p, () => document.activeElement.textContent.includes('Maple Hollow Toy Drive')), 'A: Back returns to Ohio’s list with focus on that campaign');
    await p.click('.finder-row-btn >> nth=0'); await p.keyboard.press('Escape');
    ok(await heading(p) === 'Ohio', 'A: Escape on the card also returns to Ohio’s list');
    await p.selectOption('#stateSel', 'WY');
    ok(await heading(p) === 'Wyoming' && /No campaigns in the test data are based in Wyoming/.test(await p.textContent('.finder-out')) && await p.$('.finder-out a.finder-official'), 'A: Wyoming → none in the test data + official finder link');
    await p.selectOption('#stateSel', '');
    ok(await region(p) === null && await p.$eval('.finder-out', (e) => e.children.length) === 0, 'A: "Choose a state…" clears the list');
    await p.selectOption('#stateSel', 'OH'); await p.fill('#zip', '00201'); await p.click('.finder-form [type=submit]'); await p.waitForTimeout(100);
    ok(await region(p) === null && await p.inputValue('#stateSel') === '' && /ZIP code 00201/.test(await heading(p)), 'A: a ZIP search replaces the state list and resets it');
    await p.click('.finder-row-btn >> nth=0'); await p.selectOption('#stateSel', 'ME');
    ok(await sel(p) === null && await heading(p) === 'Maine' && !(await p.$('.finder-card')), 'A: choosing a state while a card is open closes the card and lists the state');
    // keyboard: type a state name on the focused list
    await p.selectOption('#stateSel', ''); await p.focus('#stateSel'); await p.keyboard.type('Ohio'); await p.waitForTimeout(100);
    ok((await region(p)).code === 'OH' && await focusIs(p, () => document.activeElement.id === 'stateSel'), 'A: keyboard: typing "Ohio" on the list browses Ohio and focus stays on the list');
    await p.keyboard.press('Tab');
    ok(await focusIs(p, () => document.activeElement.id === 'stateFilter'), 'A: keyboard: Tab goes straight on to the filter, then the campaigns');
    ok(errors.length === 0, 'A: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, 'map=off', { viewport: { width: 390, height: 844 }, waitMap: false });
    const h = await p.$eval('#stateSel', (e) => e.getBoundingClientRect().height);
    await p.selectOption('#stateSel', 'OH');
    const fits = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    ok(h >= 44 && fits && (await rows(p)).length === 3, `A phone: state list ${Math.round(h)} px tall, Ohio's campaigns listed, no sideways scroll`);
    await p.screenshot({ path: `${out}/A_phone_ohio.png` });
    ok(errors.length === 0, 'A phone: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ B. map on, desktop
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium');
    const d0 = await p.evaluate(() => window.__nat.rig.dist);
    const az = await p.evaluate(() => window.__nat.project(-111.7, 34.3));
    await p.mouse.move(az.x, az.y); await p.mouse.down(); await p.mouse.move(az.x - 80, az.y + 30, { steps: 6 });   // to the left: dragging right slides Ohio under the finder await p.mouse.up(); await p.waitForTimeout(500);
    ok(await region(p) === null, 'B: dragging the map does not browse a state');
    const o = await clickAt(p, [-84.0, 39.6], [-84.3, 41.2], [-81.2, 39.6], [-83.5, 39.0], [-81.0, 41.3]);
    ok(o.under === 'CANVAS' && o.state === 'OH', 'B: (test) western Ohio is open map, not under a label pin');
    await p.waitForFunction(() => window.__natShell.selection.region());
    ok((await region(p)).code === 'OH' && (await region(p)).via === 'map' && await heading(p) === 'Ohio' && (await rows(p)).length === 3, 'B: clicking Ohio on the map lists Ohio’s campaigns in the finder');
    ok(await focusIs(p, () => document.activeElement.classList.contains('finder-h')) && await p.inputValue('#stateSel') === 'OH', 'B: focus moves to the Ohio heading; the state list shows Ohio');
    await settle(p); await p.waitForTimeout(800);
    let c = await p.evaluate(() => window.__nat.campaign());
    const mid = await p.evaluate(() => window.__nat.project(-82.7, 40.2));
    ok(c.browsed === 'OH' && c.outline && c.stitches > 20, `B: Ohio gets the stitched outline (${c.stitches} stitches)`);
    ok(await p.evaluate(() => window.__nat.rig.dist) < d0 * 0.5 && mid.x > mid.area.left && mid.x < mid.area.right && mid.y > mid.area.top && mid.y < mid.area.bottom, 'B: the camera moved in and Ohio sits in the open area beside the finder');
    ok(c.selected === false && await sel(p) === null, 'B: no campaign selected by the state click');
    const u = await p.evaluate(() => window.__nat.shot ? null : null);
    await p.screenshot({ path: `${out}/B_ohio_live.png`, timeout: 1000 }).catch(() => {});   // live screenshots may stall under SwiftShader
    const coast = await p.evaluate(() => window.__nat.project(-75.9, 36.0));                    // the Outer Banks; the sea lies east
    const seaX = Math.min(coast.area.right - 10, coast.x + 140);
    await p.mouse.click(seaX, coast.y); await p.waitForTimeout(800);
    ok((await region(p)).code === 'OH', 'B: clicking the ocean does nothing');
    await p.evaluate(() => window.__natShell.selection.browse(null)); await settle(p);
    const a = await clickAt(p, [-111.7, 34.3], [-112.5, 33.0], [-110.5, 35.5], [-113.5, 35.8]); await p.waitForFunction(() => window.__natShell.selection.region() && window.__natShell.selection.region().code === 'AZ');
    ok(a.state === 'AZ' && await heading(p) === 'Arizona' && (await rows(p)).join() === 'Copper Wash Toy Drive', 'B: clicking Arizona switches to Arizona and its campaign');
    await settle(p); c = await p.evaluate(() => window.__nat.campaign());
    ok(c.browsed === 'AZ' && c.outline, 'B: the outline moves to Arizona');
    await p.click('.finder-row-btn >> nth=0'); await settle(p); await p.waitForTimeout(600);
    c = await p.evaluate(() => window.__nat.campaign());
    ok((await sel(p)).id === 'test-copper-wash' && c.selected && c.visible && c.browsed === 'AZ', 'B: choosing Copper Wash from the list opens its card and pins it; Arizona stays outlined');
    await p.click('.finder-back');
    ok(await heading(p) === 'Arizona' && (await p.evaluate(() => window.__nat.campaign())).selected === false, 'B: Back returns to Arizona’s list; the pin goes');
    await p.evaluate(() => window.__natShell.selection.browse(null));
    // Alaska sits on the felt board's inset, out in the Pacific
    await p.evaluate(() => { const r = window.__nat.rig; r.dist *= 1.0; });
    const ak = await p.evaluate(() => window.__nat.project(-150, 64));
    ok(ak.state === 'AK', 'B: (lookup) a point in Alaska on the board’s inset resolves to Alaska');
    await p.selectOption('#stateSel', 'AK'); await settle(p); await p.waitForTimeout(600);
    c = await p.evaluate(() => window.__nat.campaign());
    const akMid = await p.evaluate(() => window.__nat.project(-150, 64));
    ok(c.browsed === 'AK' && c.outline && akMid.x > akMid.area.left && akMid.x < akMid.area.right && akMid.y > akMid.area.top && akMid.y < akMid.area.bottom,
      'B: choosing Alaska from the list frames the inset Alaska and outlines it');
    ok(/No campaigns in the test data are based in Alaska/.test(await p.textContent('.finder-out')), 'B: Alaska: none in the test data');
    await p.fill('#zip', '00101'); await p.click('.finder-form [type=submit]'); await p.waitForTimeout(300);
    c = await p.evaluate(() => window.__nat.campaign());
    ok(await region(p) === null && !c.outline && c.browsed === null, 'B: a ZIP search clears the state and its outline');
    const shot = await p.evaluate(() => { window.__natShell.selection.browse('OH'); return true; });
    await settle(p); await p.waitForTimeout(600);
    const url = await p.evaluate(() => window.__nat.pose({ ...window.__nat.rig }));
    fs.writeFileSync(`${out}/B_ohio.jpg`, Buffer.from(url.split(',')[1], 'base64')); await p.screenshot({ path: `${out}/B_ohio_page.png`, timeout: 300000 });
    ok(shot && errors.length === 0, 'B: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ C. existing pin and the story
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium');
    const pin = await p.$eval('#pinMaple', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.mouse.click(pin.x, pin.y);
    await p.waitForFunction(() => window.__nat.state().mode === 'story', null, { timeout: 300000, polling: 250 });
    ok(await region(p) === null, 'C: the Maple Hollow pin still starts the descent and does not browse Ohio');
    await p.mouse.click(300, 400); await p.waitForTimeout(1500);
    ok(await region(p) === null && await p.evaluate(() => window.__nat.state().mode) === 'story', 'C: clicks on the map during the story do not browse states');
    ok(errors.length === 0, 'C: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
