// The campaign finder in the browser (Milestone 1, step 2). Headless Chromium; dev server on :8765 after
// `npm run build:national` (env URL to point elsewhere, e.g. the packaged national.html).
//   node tools/tests/finder_e2e.js OUTDIR
// A. map off, desktop: visible on arrival, test-data labels, validation, serving / none / unknown / two serving /
//    inactive, nearby kept separate, card, outbound link, back, Escape, hide / show, other actions unchanged
// B. keyboard only: Tab to the ZIP field, search, open a card, follow focus back
// C. phone 390×844 and tablet 900×1000: on screen, touch-sized, no sideways scrolling, results reachable
// D. ?campaigns=official: no test data; the official campaign finder is offered instead
// E. 3D map loading (SwiftShader): the finder works before the map is ready, still works after, and tucks away when
//    the visitor heads into Maple Hollow (one tap brings it back during the story)
// Writes screenshots to OUTDIR. Exits non-zero on any failure.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const sep = BASE.includes('?') ? '&' : '?';
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };

async function open(b, query, { viewport = { width: 1280, height: 720 }, reducedMotion = 'no-preference' } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion });
  await ctx.route(/example\.org|toysfortots\.org/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outbound</title>' }));   // never leave the test machine
  const p = await ctx.newPage(); const log = { errors: [], requests: [] };
  p.on('pageerror', (e) => log.errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  p.on('request', (r) => log.requests.push(r.url()));
  await p.goto(BASE + (query ? sep + query : ''), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__natShell);
  return { ctx, p, log };
}
const focusedId = (p) => p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className));
const text = (p, sel) => p.$eval(sel, (e) => e.innerText);
// search and wait for the answer (results heading, an error, or a message); returns how long it took in ms
async function search(p, zip) {
  await p.evaluate(() => { const h = document.querySelector('.finder-out h3'); if (h) h.dataset.stale = '1'; document.getElementById('zipError').dataset.stale = '1'; });
  await p.fill('#zip', zip); const t = Date.now(); await p.click('.finder-form [type="submit"]');
  await p.waitForFunction(() => { const h = document.querySelector('.finder-out h3'), e = document.getElementById('zipError');
    return (h && !h.dataset.stale) || (!e.hidden && e.textContent && (delete e.dataset.stale, true)); }, null, { timeout: 120000, polling: 50 });
  return Date.now() - t;
}
const rows = (p) => p.$$eval('.finder-out .finder-list', (lists) => lists.map((l) => [...l.querySelectorAll('.finder-row-name')].map((n) => n.textContent)));
const subheads = (p) => p.$$eval('.finder-out .finder-sub', (h) => h.map((x) => x.textContent));

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------------------------------------------------------------- A. map off, desktop
  {
    const { ctx, p, log } = await open(b, 'map=off');
    await p.waitForSelector('.finder-test:not([hidden])');
    ok(await p.isVisible('#finder') && await p.isVisible('#zip'), 'A: finder and ZIP field visible on arrival, no click needed');
    ok(/Test data/i.test(await text(p, '.finder-test')) && /Fictional/.test(await text(p, '.finder-test')), 'A: the finder says its campaigns are fictional test data');
    ok(!log.requests.some((u) => /example\.org/.test(u)), 'A: nothing is fetched from campaign websites on load');
    await p.screenshot({ path: `${out}/A_arrival.png` });

    // validation
    await search(p, '');
    ok(/Enter your 5-digit ZIP code/.test(await text(p, '#zipError')) && await p.getAttribute('#zip', 'aria-invalid') === 'true' && await focusedId(p) === 'zip', 'A: empty search → "Enter your 5-digit ZIP code", field marked invalid and focused');
    await search(p, '12a4');
    ok(/5 numbers/.test(await text(p, '#zipError')) && await p.$eval('.finder-out', (e) => e.children.length) === 0, 'A: "12a4" → format error, no results shown');
    ok(await p.getAttribute('#zip', 'aria-describedby') === 'zipError', 'A: the error is tied to the field (aria-describedby)');
    await p.fill('#zip', '00101'); await p.dispatchEvent('#zip', 'input');
    ok(!(await p.isVisible('#zipError')) && !(await p.getAttribute('#zip', 'aria-invalid')), 'A: fixing the ZIP clears the error');

    // serving vs nearby
    await search(p, '00101-4321');
    ok(await p.inputValue('#zip') === '00101' && /ZIP code 00101/.test(await text(p, '.finder-out h3')), 'A: ZIP+4 accepted and shown as 00101');
    let L = await rows(p), H = await subheads(p);
    ok(/serves this ZIP/.test(H[0]) && L[0].join() === 'Maple Hollow Toy Drive', 'A: 00101 → "The campaign that serves this ZIP code": Maple Hollow Toy Drive');
    ok(H[1] === 'Nearby campaigns' && L[1].length > 0 && !L[1].includes('Maple Hollow Toy Drive') && /may not serve/.test(await text(p, '.finder-out')), `A: nearby campaigns listed separately with a caution: ${L[1].join(', ')}`);
    ok(/Test data/i.test(await text(p, '.finder-out h3')), 'A: results heading carries the Test data label');
    ok(await focusedId(p) === 'finder-h', 'A: focus moves to the results heading');
    ok(/1 campaign serves ZIP code 00101/.test(await p.waitForFunction(() => document.querySelector('.finder-live').textContent).then(() => p.textContent('.finder-live'))), 'A: screen readers hear a summary ("1 campaign serves ZIP code 00101…")');
    await p.screenshot({ path: `${out}/A_serving.png` });

    await search(p, '00105'); L = await rows(p);
    ok(/Campaigns that serve/.test((await subheads(p))[0]) && L[0].join() === 'Maple Hollow Toy Drive,Lanternfield Toy Collection', 'A: 00105 → two serving campaigns');
    await search(p, '00103'); L = await rows(p); H = await subheads(p);
    ok(/No campaign in the test data serves this ZIP code/.test(await text(p, '.finder-out')) && H.join() === 'Nearby campaigns' && L[0].length === 3, `A: 00103 → none serve it; nearby only: ${L[0].join(', ')}`);
    const off = await p.$('.finder-out a.finder-official');
    ok(off && await off.getAttribute('href') === 'https://www.toysfortots.org/' && await off.getAttribute('target') === '_blank' && /noopener/.test(await off.getAttribute('rel')), 'A: no serving campaign → link to the official campaign finder (new tab, noopener)');
    await p.screenshot({ path: `${out}/A_none_nearby.png` });
    await search(p, '00106'); L = await rows(p);
    ok(/No campaign/.test(await text(p, '.finder-out')) && !L.flat().includes('Bramblewood Toy Drive'), 'A: 00106 → its inactive campaign is not shown');
    await search(p, '90210');
    ok(/isn’t in the test data/.test(await text(p, '.finder-out')) && (await rows(p)).length === 0 && await p.$('.finder-out a.finder-official'), 'A: 90210 → "isn’t in the test data" + official finder link, no campaigns');

    // card, outbound link, back, Escape
    await search(p, '00103');
    await p.click('.finder-row-btn >> nth=1');
    const card = await text(p, '.finder-card');
    ok(/Lanternfield Toy Collection/.test(card) && /Nearby: about \d+ miles from ZIP code 00103\. It may not serve that ZIP code\./.test(card), 'A: card for a nearby campaign says it may not serve the ZIP');
    ok(/Area served\s+Lanternfield and Juniper County/.test(card) && /Based in\s+Lanternfield, Ohio/.test(card) && /Fictional campaign for testing/.test(card), 'A: card shows area served, location and the fictional-data note');
    ok(await focusedId(p) === 'finderCardName', 'A: focus moves to the card heading');
    const site = await p.$('a.finder-site');
    ok(await site.getAttribute('href') === 'https://example.org/test-campaigns/lanternfield' && await site.getAttribute('target') === '_blank' && await site.getAttribute('rel') === 'noopener noreferrer' && /opens in a new tab/.test(await site.innerText()),
      'A: website link: the campaign URL, new tab, noopener noreferrer, announced as opening a new tab');
    const [popup] = await Promise.all([ctx.waitForEvent('page'), site.click()]);
    await popup.waitForLoadState(); ok(popup.url() === 'https://example.org/test-campaigns/lanternfield' && await popup.evaluate(() => window.opener === null), 'A: clicking it opens that URL in a new tab with no link back to this page');
    await popup.close();
    ok(/Lanternfield/.test(await text(p, '.finder-card')), 'A: the card is still there after following the link');
    await p.screenshot({ path: `${out}/A_card.png` });
    await p.click('.finder-back');
    ok((await rows(p))[0].length === 3 && await p.evaluate(() => document.activeElement.textContent.includes('Lanternfield')), 'A: "Back to results" returns to the list with focus on the campaign you opened');
    await p.click('.finder-row-btn >> nth=0'); await p.keyboard.press('Escape');
    ok(await p.$('.finder-card') === null && (await rows(p)).length === 1, 'A: Escape on a card goes back to the results');
    await search(p, '00105'); await p.click('.finder-row-btn >> nth=0');
    ok(/Serves ZIP code 00105/.test(await text(p, '.finder-card')), 'A: card for a serving campaign says "Serves ZIP code 00105"');
    await search(p, '00201');
    ok(/Copper Wash Toy Drive/.test(await text(p, '.finder-out')) && !(await p.$('.finder-card')), 'A: a new search from the card replaces it with fresh results');

    // card opened directly (how the map will open it in step 3)
    await p.evaluate(() => window.__natShell.finder.showCampaign('test-pine-harbor'));
    ok(/Pine Harbor Toy Drive/.test(await text(p, '.finder-card')) && !/Serves ZIP|Nearby:/.test(await text(p, '.finder-card')), 'A: showCampaign(id) opens the same card without a ZIP relation');
    ok(await p.evaluate(() => window.__natShell.finder.showCampaign('no-such-id')) === false, 'A: showCampaign with an unknown id does nothing');

    // hide / show and the top-bar action
    await p.click('.finder-hide');
    ok(!(await p.isVisible('#finder')) && await p.isVisible('#finderPill') && await focusedId(p) === 'finderPill' && await p.getAttribute('#finderPill', 'aria-expanded') === 'false', 'A: Hide tucks the finder into a "Find your local campaign" button (focus follows)');
    await p.click('#finderPill');
    ok(await p.isVisible('#finder') && await focusedId(p) === 'zip', 'A: that button brings it back with the ZIP field focused');
    await p.click('.finder-hide'); await p.click('[data-action="campaign"]');
    ok(await p.isVisible('#finder') && await focusedId(p) === 'zip' && !(await p.isVisible('#notyet')), 'A: top-bar "Find Local Campaign" opens the finder (no placeholder dialog)');
    for (const a of ['give', 'donate', 'request']) {
      await p.click(`[data-action="${a}"]`); const dlg = await p.isVisible('#notyet'); await p.click('#notyet [data-close]');
      ok(dlg, `A: "${a}" still opens its placeholder dialog`);
    }
    ok(log.errors.length === 0, 'A: no page errors ' + log.errors.join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- B. keyboard only
  {
    const { ctx, p, log } = await open(b, 'map=off');
    await p.waitForSelector('.finder-test:not([hidden])');
    let n = 0; while (await focusedId(p) !== 'zip' && n++ < 20) await p.keyboard.press('Tab');
    ok(await focusedId(p) === 'zip', `B: Tab reaches the ZIP field (${n} presses from the top of the page)`);
    await p.keyboard.type('00101'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
    ok(await focusedId(p) === 'finder-h' && /ZIP code 00101/.test(await p.evaluate(() => document.activeElement.textContent)), 'B: Enter searches; focus lands on the results heading');
    await p.keyboard.press('Tab');
    ok(await p.evaluate(() => document.activeElement.classList.contains('finder-row-btn')), 'B: next Tab reaches the first campaign');
    await p.keyboard.press('Enter');
    ok(await focusedId(p) === 'finderCardName', 'B: Enter opens its card; focus on the card heading');
    let reached = false; for (let i = 0; i < 4 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate(() => document.activeElement.classList.contains('finder-site')); }
    ok(reached, 'B: Tab reaches "Visit the campaign’s website"');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => document.activeElement.classList.contains('finder-row-btn')), 'B: Escape returns to the results with focus on that campaign');
    const ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
    ok(ring, 'B: the focused control shows a visible focus ring');
    ok(log.errors.length === 0, 'B: no page errors ' + log.errors.join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- C. phone and tablet
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 900, height: 1000 }]]) {
    const { ctx, p, log } = await open(b, 'map=off', { viewport });
    await p.waitForSelector('.finder-test:not([hidden])');
    const box = await p.$eval('#finder', (e) => e.getBoundingClientRect().toJSON());
    ok(box.left >= 8 && box.right <= viewport.width - 8 && box.top < 200, `C ${name}: finder on screen under the top bar (top ${Math.round(box.top)} px)`);
    const h = (sel) => p.$$eval(sel, (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    const [zipH] = await h('#zip'), [goH] = await h('.finder-form [type=submit]'), small = [...await h('.finder-test button'), ...await h('.finder-hide')];
    ok(zipH >= 44 && goH >= 44 && small.every((x) => x >= 32), `C ${name}: touch sizes ok (field ${zipH}, search ${goH}, test ZIPs / Hide ${small.join('/')} px)`);
    ok(await p.$eval('#zip', (e) => parseFloat(getComputedStyle(e).fontSize)) >= 16 && await p.getAttribute('#zip', 'inputmode') === 'numeric', `C ${name}: numeric keypad, text ≥16 px (no zoom-on-focus)`);
    await p.screenshot({ path: `${out}/C_${name}_arrival.png` });
    await p.click('[data-try="00103"]'); await p.waitForTimeout(100);
    const fits = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const bar = name === 'phone' ? await p.$eval('.actions', (e) => e.getBoundingClientRect().top) : viewport.height;
    const fb = await p.$eval('#finder', (e) => e.getBoundingClientRect().bottom);
    ok(fits && fb <= bar, `C ${name}: results fit (no sideways scroll; finder ends at ${Math.round(fb)} px, above the help bar at ${Math.round(bar)} px)`);
    await p.$eval('#finder', (e) => { e.scrollTop = e.scrollHeight; });
    ok(await p.isVisible('.finder-official') && await p.$eval('.finder-official', (e) => { const r = e.getBoundingClientRect(), f = document.getElementById('finder').getBoundingClientRect(); return r.bottom <= f.bottom + 1; }), `C ${name}: the end of the results can be scrolled to inside the finder`);
    await p.screenshot({ path: `${out}/C_${name}_results.png` });
    await p.$eval('#finder', (e) => { e.scrollTop = 0; }); await p.click('.finder-row-btn >> nth=0');
    await p.$eval('#finder', (e) => { e.scrollTop = e.scrollHeight; });
    ok(await p.isVisible('a.finder-site'), `C ${name}: the card's website button is reachable`);
    await p.screenshot({ path: `${out}/C_${name}_card.png` });
    ok(log.errors.length === 0, `C ${name}: no page errors ` + log.errors.join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- D. official source (as production would be today)
  {
    const { ctx, p, log } = await open(b, 'map=off&campaigns=official');
    await p.waitForSelector('.finder-msg');
    ok(!(await p.isVisible('.finder-form')) && !(await p.isVisible('.finder-test')) && !log.requests.some((u) => /campaigns\.test/.test(u)), 'D: no ZIP form, no test-data note, and the test file is never requested');
    ok(/isn’t connected/.test(await text(p, '.finder-msg')) && await p.getAttribute('.finder-msg a', 'href') === 'https://www.toysfortots.org/', 'D: says search isn’t connected and links to the official site instead');
    await p.click('[data-action="campaign"]');
    ok(await p.evaluate(() => document.activeElement.classList.contains('finder-official')), 'D: "Find Local Campaign" focuses the official link');
    await p.screenshot({ path: `${out}/D_official.png` });
    ok(log.errors.length === 0, 'D: no page errors ' + log.errors.join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- E. with the 3D map loading
  {
    const { ctx, p, log } = await open(b, 'capture=1&q=medium', { reducedMotion: 'reduce' });
    await p.waitForSelector('.finder-test:not([hidden])');
    const before = await p.evaluate(() => !window.__nat);
    const ms = await search(p, '00101');
    ok(before && /Maple Hollow Toy Drive/.test(await text(p, '.finder-out')), `E: a search works while the 3D map is still loading (answer in ${ms} ms, SwiftShader)`);
    ok(await p.evaluate(() => window.__natShell.world) === true, 'E: the 3D map then loads');
    const ms2 = await search(p, '00103');
    ok(/Nearby campaigns/i.test(await text(p, '.finder-out')), `E: the finder still works with the map running (answer in ${ms2} ms; SwiftShader draws a frame every ~2 s, so this is not a real-device number)`);
    await p.click('#descend');
    await p.waitForFunction(() => window.__nat.state().mode === 'story', null, { timeout: 300000, polling: 250 });
    ok(!(await p.isVisible('#finder')) && await p.isVisible('#finderPill') && await p.isVisible('#storybar'), 'E: heading into Maple Hollow tucks the finder away; the story controls show');
    await p.click('#finderPill');
    ok(await p.isVisible('#finder') && /Nearby campaigns/i.test(await text(p, '.finder-out')), 'E: during the story, one tap brings the finder back with the earlier results');
    ok(log.errors.length === 0, 'E: no page errors ' + log.errors.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
