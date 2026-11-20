// Phase 1, Milestone 1: the continuous-world spike (experiment/phase1-build). Headless Chromium + SwiftShader (no GPU:
// a frame can take seconds, so timings here are not real-device numbers).   URL=… node tools/tests/toytown_spike.js OUTDIR
// A. reduced motion: Explore Toy Town → a crossfade (no flight) → the first story shot, live in the 3D street; Next moves
//    the camera to the next shot; Skip story → the finale over the whole country; Back to the map → the landing
// B. full motion: Explore → the flight, with Skip the flight focused; Skip → arrival; the finder over the live street
//    keeps the beat; Exit Toy Town → the rise back (Escape skips it) → the landing, focus on Explore
// C. map off: Explore → the story with stills, no flight
// D. ?town=maple: the street back in Ohio (reversible)
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const LONG = 600000;

async function open(b, query, { reducedMotion = 'reduce', viewport = { width: 1280, height: 720 }, waitMap = true } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion });
  await ctx.route(/example\.org|toysfortots\.org/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outbound</title>' }));
  const p = await ctx.newPage(); const errors = []; p.setDefaultTimeout(LONG);
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + '?' + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__natShell);
  if (waitMap) await p.waitForFunction(() => window.__natWorld && window.__nat, null, { timeout: LONG, polling: 500 });
  return { ctx, p, errors };
}
const st = (p) => p.evaluate(() => window.__nat.state());
const pos = (p) => p.evaluate(() => { const s = window.__natShell.story.position(); return s && `${s.chapterId}/${s.beatId}`; });
const focused = (p) => p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className));
const waitMode = (p, m) => p.waitForFunction((m) => window.__nat.state().mode === m, m, { timeout: LONG, polling: 200 });
// a posed still of the live canvas, then a page screenshot (the loop stops; take it last in a scenario)
const still = async (p, path) => { await p.evaluate(() => window.__nat.pose({ ...window.__nat.rig })); await p.screenshot({ path, timeout: LONG }); };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ------------------------------------------------------------ A. reduced motion
  {
    const { ctx, p, errors } = await open(b, 'capture=1');
    ok(await p.evaluate(() => window.__natWorld.oneTown), 'A: one Toy Town: the street is at the Toy Town hub');
    const t0 = Date.now();
    await p.click('#exploreBtn');
    ok(await p.isHidden('#skipFlight'), 'A: reduced motion: no flight, so no Skip the flight button');
    await p.waitForSelector('#story:not([hidden])', { timeout: LONG });
    await waitMode(p, 'shot');
    const s = await st(p);
    ok(s.mode === 'shot' && s.held === 0 && await pos(p) === 'what/welcome', `A: Explore Toy Town arrives at the first story shot (${((Date.now() - t0) / 1000).toFixed(1)} s here, with a crossfade)`);
    ok(await p.evaluate(() => document.body.classList.contains('story-live') && document.getElementById('story').classList.contains('live') && !document.querySelector('.story-scene')), 'A: the beat is shown in the live 3D street, not a still');
    ok(/\bstory-text\b/.test(await focused(p)), 'A: focus is on the story text on arrival');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.world-fade')).transitionProperty.includes('opacity')), 'A: the reduced-motion transition is a fade (opacity only)');
    await p.click('.story-next');
    await p.waitForFunction(() => window.__nat.state().held === 4.2 && window.__nat.state().mode === 'shot', null, { timeout: LONG });
    ok(await pos(p) === 'what/community', 'A: Next: the camera moves to the next shot in the same street');
    await p.click('.story-step[data-chapter="2"]');                 // (Chapter 2 plays live since Milestone 2A; Chapter 3 is not built yet)
    await p.waitForSelector('.story-scene img, .story-slate', { timeout: LONG });
    ok(await p.evaluate(() => !document.body.classList.contains('story-live')), 'A: Chapter 3 (not built yet) falls back to its placeholder, cleanly');
    await p.click('.story-skip');
    await waitMode(p, 'finale');
    ok(await pos(p) === 'finale/yours' && await p.evaluate(() => document.body.classList.contains('story-live')), 'A: Skip story: the finale is shown over the whole country (the camera rose out of Toy Town)');
    ok(await p.isHidden('#pinToy'), 'A: map labels stay hidden while the finale card is up');
    await still(p, `${out}/A_finale_desktop.png`);
    ok(errors.length === 0, 'A: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  // back to the map from the finale (fresh page: the posed still above stopped that page's loop)
  {
    const { ctx, p, errors } = await open(b, 'capture=1');
    await p.click('#exploreBtn'); await waitMode(p, 'shot');
    await p.click('.story-skip'); await waitMode(p, 'finale');
    await p.click('.story-map');
    await waitMode(p, 'national');
    ok(await p.isHidden('#story') && await focused(p) === 'exploreBtn' && await p.isVisible('#landing'), 'A: Back to the map: the landing returns, focus on Explore Toy Town');
    ok(errors.length === 0, 'A2: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ B. full motion
  {
    const { ctx, p, errors } = await open(b, 'capture=1', { reducedMotion: 'no-preference' });
    await p.click('#exploreBtn');
    await p.waitForSelector('#skipFlight:not([hidden])');
    ok(await focused(p) === 'skipFlight' && await p.evaluate(() => document.body.classList.contains('traveling')), 'B: Explore Toy Town starts the flight; Skip the flight is shown and focused; the landing steps aside');
    ok(await p.evaluate(() => document.getElementById('flightLive').textContent.includes('Toy Town')), 'B: the flight is announced to screen readers');
    await p.waitForFunction(() => window.__nat.rig.dist < 300, null, { timeout: LONG, polling: 200 });
    ok((await st(p)).mode === 'flying', 'B: the camera is flying down (continuous: no page change)');
    await p.click('#skipFlight');
    await waitMode(p, 'shot');
    await p.waitForSelector('#story:not([hidden])');
    ok(await pos(p) === 'what/welcome' && await p.isHidden('#skipFlight') && /\bstory-text\b/.test(await focused(p)), 'B: Skip the flight lands at the first shot; the story opens with focus on its text');
    // the finder over the live street
    await p.click('.story-find');
    await p.waitForSelector('body.story-finder');
    ok((await st(p)).mode === 'shot' && await p.evaluate(() => document.body.classList.contains('story-live')), 'B: the finder opens over the live street; the scene holds its shot');
    await p.click('.finder-hide');
    ok(await pos(p) === 'what/welcome' && (await st(p)).held === 0 && /story-find/.test(await focused(p)), 'B: closing the finder returns to the same beat and shot');
    await still(p, `${out}/B_arrival_desktop.png`);
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, 'capture=1', { reducedMotion: 'no-preference' });
    await p.click('#exploreBtn'); await p.waitForSelector('#skipFlight:not([hidden])'); await p.click('#skipFlight'); await waitMode(p, 'shot');
    await p.waitForSelector('#story:not([hidden])');
    await p.click('.story-exit');
    await p.waitForSelector('#skipFlight:not([hidden])');
    ok((await st(p)).mode === 'flying' && await p.isHidden('#story'), 'B: Exit Toy Town: the camera rises back to the country, with Skip the flight');
    await p.keyboard.press('Escape');
    await waitMode(p, 'national');
    ok(await p.isVisible('#landing') && await focused(p) === 'exploreBtn' && /Continue Toy Town/.test(await p.textContent('#exploreBtn')), 'B: Escape skips the rise; back on the landing, focus on Continue Toy Town');
    ok(errors.length === 0, 'B: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ C. map off
  {
    const { ctx, p, errors } = await open(b, 'map=off', { waitMap: false });
    await p.click('#exploreBtn');
    await p.waitForSelector('#story:not([hidden])');
    ok(await p.isVisible('.story-scene img') && await p.isHidden('#skipFlight') && await pos(p) === 'what/welcome', 'C: map off: Explore Toy Town opens the story with its stills, no flight');
    ok(errors.length === 0, 'C: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ D. reversible
  {
    const { ctx, p } = await open(b, 'capture=1&town=maple');
    ok(await p.evaluate(() => !window.__natWorld.oneTown), 'D: ?town=maple puts the street back in Ohio (the spike is reversible)');
    await ctx.close();
  }

  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
