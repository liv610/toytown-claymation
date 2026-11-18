// The Phase 1 visitor flow (Milestone 1): both journeys, the Toy Town story frame, and the shared finder inside it.
// Headless Chromium; dev server on :8765 after `npm run build:national` (env URL to point elsewhere). SwiftShader for
// the map-on parts: frame times are not real-device numbers.
//   node tools/tests/visitor_flow.js OUTDIR
// A. Journey A (desktop, phone, small phone): both entry points on screen without scrolling; ZIP → card with the ZIP,
//    Change and Visit Campaign Website; never enters Toy Town
// B. Journey B: Explore Toy Town → every beat of all four chapters → finale; Back; progress jumps; Read as text
// C. the finder from every chapter: opens over the story (ZIP field, or the kept card), website reachable, closing or
//    Escape returns to the same chapter and beat with focus back on the button that opened it
// D. Skip → finale → Find My Local Campaign → card → website; donation kept separate (placeholder)
// E. Exit keeps the place and the campaign; Continue resumes; Start over restarts
// F. keyboard only; G. reduced motion; H. screen-reader cues; I. phone menu and story sheet
// J. with the 3D map: entry points, the Toy Town star opens the story, the map frames a campaign chosen in the story,
//    Maple Hollow's entrance only with ?maplehollow=1;  K. no WebGL
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const DESK = { width: 1280, height: 720 }, PHONE = { width: 390, height: 844 }, SMALL = { width: 375, height: 667 };

async function open(b, query, { viewport = DESK, reducedMotion = 'no-preference', noWebGL = false, waitMap = false } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion });
  await ctx.route(/example\.org|toysfortots\.org/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outbound</title>' }));
  const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebGL context/.test(m.text())) errors.push(m.text()); });
  if (noWebGL) await p.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
  await p.goto(BASE + '?' + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__natShell); await p.waitForSelector('.finder-test:not([hidden])');
  if (waitMap) { await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 }); await p.waitForTimeout(1200); }
  return { ctx, p, errors };
}
const pos = (p) => p.evaluate(() => window.__natShell.story.position());
const focused = (p) => p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : null; });
const inView = (p, sel) => p.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; });
const noSideScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
async function search(p, zip) {
  if (await p.isVisible('.finder-change')) await p.click('.finder-change');
  await p.evaluate(() => { const h = document.querySelector('.finder-out h3'); if (h) h.dataset.stale = '1'; });
  await p.fill('#zip', zip); await p.click('.finder-form [type="submit"]');
  await p.waitForFunction(() => { const h = document.querySelector('.finder-out h3'); return h && !h.dataset.stale; });
}
const sel = (p) => p.evaluate(() => { const s = window.__natShell.selection.get(); return s && s.id; });
async function nextTimes(p, n) { for (let i = 0; i < n; i++) await p.click('.story-next'); }

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ------------------------------------------------------------ A. Journey A
  for (const [name, viewport] of [['desktop', DESK], ['phone', PHONE], ['small phone', SMALL]]) {
    const { ctx, p, errors } = await open(b, 'map=off', { viewport });
    ok(await inView(p, '#zip') && await inView(p, '.finder-form [type=submit]') && await inView(p, '#exploreBtn'), `A ${name}: ZIP field, Search and Explore Toy Town all on screen without scrolling`);
    ok(/connect with Toys for Tots in your community/.test(await p.textContent('.finder-intro')) && /Discover how toys travel from neighbors to families/.test(await p.textContent('#exploreBtn')), `A ${name}: the two invitations carry the approved lines`);
    const eh = await p.$eval('#exploreBtn', (e) => e.getBoundingClientRect().height);
    ok(eh >= 56, `A ${name}: Explore Toy Town is a full entry point (${Math.round(eh)} px tall), not a small link`);
    await search(p, '00101');
    ok(await p.isVisible('.finder-card') && /Maple Hollow Toy Drive/.test(await p.textContent('#finderCardName')) && /Test data/i.test(await p.textContent('#finderCardName')), `A ${name}: one serving campaign: its card, labelled test data`);
    ok(/ZIP 00101/.test(await p.textContent('.finder-zipline')) && await p.isVisible('.finder-change') && !(await p.isVisible('.finder-form')), `A ${name}: the search becomes the result: "ZIP 00101 · Change", no second ZIP field`);
    const site = await p.$('a.finder-site');
    ok(/^Visit Campaign Website/.test(await site.innerText()) && await site.getAttribute('href') === 'https://example.org/test-campaigns/maple-hollow' && await site.getAttribute('target') === '_blank' && await site.getAttribute('rel') === 'noopener noreferrer', `A ${name}: Visit Campaign Website → the campaign's site, new tab`);
    ok(await inView(p, 'a.finder-site'), `A ${name}: the website button is on screen right after the search`);
    ok(await inView(p, '#exploreBtn') && await p.$eval('a.finder-site', (a) => a.getBoundingClientRect().top) < await p.$eval('#exploreBtn', (e) => e.getBoundingClientRect().top), `A ${name}: Explore Toy Town stays on screen with the card, below the website link`);
    const [popup] = await Promise.all([ctx.waitForEvent('page'), site.click()]);
    ok(popup.url() === 'https://example.org/test-campaigns/maple-hollow', `A ${name}: it opens the campaign website`); await popup.close();
    ok(await p.isHidden('#story') && await pos(p) === null, `A ${name}: done without entering Toy Town`);
    if (name !== 'desktop') {
      ok(!(await p.isVisible('#finderDetails')) && await p.isVisible('.finder-more'), `A ${name}: extra details wait behind "Details"`);
      await p.click('.finder-more'); ok(await p.isVisible('#finderDetails'), `A ${name}: "Details" shows area served and location`);
    }
    await p.click('.finder-change');
    ok(await focused(p) === 'zip' && !(await p.isVisible('.finder-card')) && await sel(p) === null, `A ${name}: Change returns to the ZIP field`);
    ok(await noSideScroll(p), `A ${name}: no sideways scrolling`);
    await p.screenshot({ path: `${out}/A_${name.replace(' ', '_')}.png` });
    ok(errors.length === 0, `A ${name}: no page errors ` + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ B. Journey B: every beat, Back, progress, Read as text
  {
    const { ctx, p, errors } = await open(b, 'map=off');
    const chapters = await p.evaluate(() => window.__natShell.story.chapters());
    await p.click('#exploreBtn');
    ok(await p.isVisible('#story') && JSON.stringify(await pos(p)) === JSON.stringify({ chapter: 0, beat: 0, chapterId: 'what', beatId: 'welcome' }) && await focused(p) === 'story-text', 'B: Explore Toy Town opens Chapter 1, first beat, focus on its text');
    const seen = [];
    for (let guard = 0; guard < 40; guard++) {
      const q = await pos(p); seen.push(`${q.chapterId}/${q.beatId}`);
      if (!(await p.isVisible('.story-next'))) break;
      await p.click('.story-next');
    }
    const want = chapters.flatMap((c) => c.beats.map((x) => `${c.id}/${x}`));
    ok(JSON.stringify(seen) === JSON.stringify(want), `B: Next walks every beat of all four chapters to the finale (${seen.length} beats)`);
    ok(/Every community has a part to play\. Find yours\./.test(await p.textContent('.story-text')), 'B: the finale says "Every community has a part to play. Find yours."');
    ok(await p.$$eval('.story-step.done', (e) => e.length) === 4, 'B: all four chapters show as done at the finale');
    await p.click('.story-step[data-chapter="2"]');
    ok((await pos(p)).chapterId === 'request' && (await pos(p)).beat === 0 && await p.getAttribute('.story-step[data-chapter="2"]', 'aria-current') === 'step', 'B: the progress jumps to a chapter (Chapter 3)');
    await p.click('.story-back');
    ok((await pos(p)).chapterId === 'how' && (await pos(p)).beatId === 'share', 'B: Back from a chapter’s first beat goes to the previous chapter’s last beat');
    await p.click('.story-step[data-chapter="0"]');
    ok(await p.isDisabled('.story-back'), 'B: Back is disabled at the very start');
    await p.click('.story-read');
    const txt = await p.textContent('#storyText');
    ok(await p.isVisible('#storyText') && ['Chapter 1: What is Toys for Tots?', 'Chapter 2: How does it work?', 'Chapter 3: How do I request toys?', 'Chapter 4: How can I help?', 'Every community has a part to play'].every((t) => txt.includes(t)), 'B: Read as text holds all four chapters and the finale');
    ok(/Scene: /.test(txt) && /To confirm with Toys for Tots/.test(txt) && /Requests aren’t made on this site/.test(txt), 'B: …with scene descriptions, the request-process note and the facts to confirm');
    await p.click('#storyText [data-close]');
    ok(!(await p.isVisible('#storyText')) && (await pos(p)).chapter === 0, 'B: closing it returns to the same place');
    await p.screenshot({ path: `${out}/B_story_desktop.png` });
    ok(errors.length === 0, 'B: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ C. the finder from every chapter (and its return)
  {
    const { ctx, p, errors } = await open(b, 'map=off');
    await p.click('#exploreBtn');
    const chapters = await p.evaluate(() => window.__natShell.story.chapters());
    for (let i = 0; i < chapters.length; i++) {
      await p.click(i < 4 ? `.story-step[data-chapter="${i}"]` : '.story-skip');
      if (chapters.at(i).beats.length > 1) await p.click('.story-next');
      const before = await pos(p);
      await p.click('.story-find');
      ok(await p.isVisible('#finder') && await p.textContent('.finder-hide') === '← Back to the story', `C ${chapters.at(i).id}: Find Local Campaign opens the shared finder over the story`);
      if (i === 0) {
        ok(await focused(p) === 'zip', 'C what: nothing chosen yet → the ZIP field, focused');
        await search(p, '00201');
        const site = await p.$('a.finder-site');
        const [popup] = await Promise.all([ctx.waitForEvent('page'), site.click()]);
        ok(popup.url() === 'https://example.org/test-campaigns/copper-wash', 'C what: search inside the story, then Visit Campaign Website, without finishing the story'); await popup.close();
        await p.click('.finder-hide');
      } else {
        ok(await p.isVisible('.finder-card') && /Copper Wash Toy Drive/.test(await p.textContent('#finderCardName')) && await p.isVisible('a.finder-site') && await focused(p) === 'finderCardName', `C ${chapters.at(i).id}: the kept campaign card is there at once, website button ready`);
        await p.keyboard.press('Escape');
      }
      const after = await pos(p);
      ok(!(await p.isVisible('#finder')) && JSON.stringify(after) === JSON.stringify(before) && await p.evaluate(() => document.activeElement.classList.contains('story-find')), `C ${chapters.at(i).id}: closing returns to ${before.chapterId}/${before.beatId}, focus on Find Local Campaign`);
    }
    ok(await sel(p) === 'test-copper-wash', 'C: the chosen campaign stays selected throughout');
    // the chapter actions
    await p.click('.story-step[data-chapter="2"]'); await p.click('.story-next');
    await p.click('.story-act-finder');
    ok(await p.isVisible('.finder-card'), 'C request: Chapter 3’s "Find My Local Campaign" opens the same card');
    await p.click('.finder-hide');
    ok(await p.evaluate(() => document.activeElement.classList.contains('story-act-finder')) && (await pos(p)).beatId === 'steps', 'C request: …and returns to the steps, focus on that button');
    await p.click('.story-step[data-chapter="3"]'); await p.click('.story-next');
    await p.click('.story-act-donate');
    ok(await p.isVisible('#notyet') && /Make a Monetary Donation/.test(await p.textContent('#nyTitle')), 'C help: "Make a Monetary Donation" is separate from the finder (placeholder until the official link is confirmed)');
    await p.click('#notyet [data-close]');
    ok(errors.length === 0, 'C: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ D. Skip → finale → finder → website (fresh visitor)
  {
    const { ctx, p, errors } = await open(b, 'map=off');
    await p.click('#exploreBtn'); await p.click('.story-skip');
    ok((await pos(p)).chapterId === 'finale' && await p.isHidden('.story-next') && await p.isHidden('.story-skip'), 'D: Skip story goes straight to the finale');
    const acts = await p.$$eval('.story-actions button', (bs) => bs.map((x) => x.textContent));
    ok(JSON.stringify(acts) === JSON.stringify(['Find My Local Campaign', 'Make a Monetary Donation', 'Replay the story', 'Back to the map']), 'D: finale actions: Find My Local Campaign first, donation separate, replay, map');
    ok(await p.evaluate(() => document.activeElement.classList.contains('story-act-finder')), 'D: focus lands on Find My Local Campaign');
    await p.click('.story-act-finder');
    ok(await focused(p) === 'zip', 'D: a new visitor gets the ZIP field');
    await search(p, '00105');
    ok(await p.$eval('.finder-out .finder-list', (l) => l.querySelectorAll('.finder-row-btn').length) === 2, 'D: two campaigns serve 00105: a choice (nearby ones listed apart)');
    await p.click('.finder-row-btn >> nth=1');
    ok(/Lanternfield/.test(await p.textContent('#finderCardName')) && await p.isVisible('a.finder-site'), 'D: choosing one shows its card and Visit Campaign Website');
    await p.click('.finder-hide');
    await p.click('.story-replay');
    ok((await pos(p)).chapter === 0 && (await pos(p)).beat === 0, 'D: Replay starts the story again');
    ok(errors.length === 0, 'D: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ E. Exit, continue, start over
  {
    const { ctx, p, errors } = await open(b, 'map=off');
    await search(p, '00101');
    await p.click('#exploreBtn'); await p.click('.story-step[data-chapter="1"]'); await p.click('.story-next');
    await p.click('.story-exit');
    ok(await p.isHidden('#story') && await p.isVisible('#finder') && await p.isVisible('.finder-card') && await sel(p) === 'test-maple-hollow', 'E: Exit Toy Town returns to the map with the campaign card still there');
    ok(/Continue Toy Town/.test(await p.textContent('#exploreBtn')) && /chapter 2/.test(await p.textContent('#exploreBtn')) && await p.isVisible('#exploreRestart') && await focused(p) === 'exploreBtn', 'E: the entry now offers to continue at chapter 2 (focus on it), or start over');
    await p.click('#exploreBtn');
    ok((await pos(p)).chapterId === 'how' && (await pos(p)).beatId === 'pickup', 'E: Continue resumes the same chapter and beat');
    await p.keyboard.press('Escape');
    ok(await p.isHidden('#story'), 'E: Escape in the story (nothing else open) leaves Toy Town');
    await p.click('#exploreRestart');
    ok((await pos(p)).chapter === 0 && (await pos(p)).beat === 0, 'E: Start the story over begins at Chapter 1');
    ok(errors.length === 0, 'E: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ F. keyboard only
  {
    const { ctx, p, errors } = await open(b, 'map=off');
    let n = 0; while (await focused(p) !== 'exploreBtn' && n++ < 30) await p.keyboard.press('Tab');
    ok(await focused(p) === 'exploreBtn', `F: Tab reaches Explore Toy Town (${n} presses)`);
    await p.keyboard.press('Enter');
    ok(await focused(p) === 'story-text', 'F: Enter opens the story; focus on the beat text');
    const order = []; for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => document.activeElement.className.split(' ').filter((c) => c.startsWith('story-')).join('') || document.activeElement.className)); }
    const iNext = order.indexOf('story-next'), iFind = order.indexOf('story-find');
    ok(iNext >= 0 && iFind >= 0 && order.includes('story-skip') && order.includes('story-read') && order.includes('story-exit'), `F: Tab reaches Find, Exit, Back/Next, Skip and Read as text (${order.filter(Boolean).slice(0, 9).join(', ')})`);
    ok(!order.some((c) => /\bact\b|finder|explore/.test(c)), 'F: Tab stays inside the story (the page behind it is inert)');
    await p.focus('.story-next'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
    ok((await pos(p)).beatId === 'follow', 'F: Enter on Next moves on, focus stays on Next');
    await p.focus('.story-find'); await p.keyboard.press('Enter');
    ok(await focused(p) === 'zip', 'F: Find Local Campaign by keyboard → the ZIP field');
    await p.keyboard.type('00101'); await p.keyboard.press('Enter'); await p.waitForSelector('.finder-card');
    ok(await focused(p) === 'finderCardName', 'F: Enter searches; focus on the card');
    await p.keyboard.press('Tab');
    ok(await p.evaluate(() => document.activeElement.classList.contains('finder-site')), 'F: next Tab is Visit Campaign Website');
    await p.keyboard.press('Escape');
    ok((await pos(p)).beatId === 'follow' && await p.evaluate(() => document.activeElement.classList.contains('story-find')), 'F: Escape → back to the same beat, focus on Find Local Campaign');
    const ring = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
    ok(ring, 'F: visible focus ring');
    ok(errors.length === 0, 'F: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ G. reduced motion; H. screen-reader cues
  {
    const { ctx, p, errors } = await open(b, 'map=off', { reducedMotion: 'reduce' });
    await p.click('#exploreBtn'); await p.click('.story-next');
    const t = await p.$eval('.story-scene:last-child', (e) => getComputedStyle(e).transitionDuration);
    ok(t === '0s' && await p.$$eval('.story-scene', (s) => s.length) === 1, `G: reduced motion: scenes switch without a fade (${t})`);
    const before = await pos(p); await p.waitForTimeout(3000);
    ok(JSON.stringify(await pos(p)) === JSON.stringify(before), 'G: nothing advances on its own');
    await p.waitForFunction(() => /Chapter 1 of 4/.test(document.querySelector('.story-live').textContent));
    ok(/Chapter 1 of 4 · What is Toys for Tots\?\. Every holiday season/.test(await p.textContent('.story-live')), 'H: each beat is announced once (chapter, then its text)');
    ok(await p.getAttribute('.story-stage', 'aria-hidden') === 'true' && (await p.textContent('.story-scene-alt')).length > 20, 'H: the picture is hidden from screen readers; its description is text');
    ok(await p.getAttribute('.story-step[data-chapter="0"]', 'aria-current') === 'step' && await p.getAttribute('.story-step[data-chapter="1"]', 'aria-label') === 'Chapter 2: How does it work?', 'H: progress reads as chapters, the current one marked');
    ok(errors.length === 0, 'G/H: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ I. phone: the menu and the story sheet
  for (const [name, viewport] of [['phone', PHONE], ['small phone', SMALL]]) {
    const { ctx, p, errors } = await open(b, 'map=off', { viewport });
    ok(!(await p.isVisible('#helpActions')) && await p.isVisible('#helpMenu'), `I ${name}: no fixed four-button bar; one "Ways to help" button`);
    await p.click('#helpMenu');
    ok(await p.isVisible('#helpActions') && await p.getAttribute('#helpMenu', 'aria-expanded') === 'true', `I ${name}: it opens the help actions`);
    await p.click('[data-action="donate"]');
    ok(await p.isVisible('#notyet') && !(await p.isVisible('#helpActions')), `I ${name}: an action runs and the menu closes`);
    await p.click('#notyet [data-close]');
    await p.click('#exploreBtn');
    ok(await inView(p, '.story-next') && await inView(p, '.story-find') && await inView(p, '.story-exit'), `I ${name}: in the story, Next, Find Local Campaign and Exit are all on screen`);
    const stageH = await p.$eval('.story-stage', (e) => e.getBoundingClientRect().height);
    ok(stageH > viewport.height * 0.25, `I ${name}: the scene keeps ${Math.round(stageH)} px of the screen`);
    await p.click('.story-step[data-chapter="2"]'); await p.click('.story-next');
    ok(await inView(p, '.story-next') && await inView(p, '.story-back'), `I ${name}: on the longest beat (the four steps) Back and Next stay on screen; the text scrolls`);
    ok(await inView(p, '.story-act-finder') || await p.$eval('.story-card', (c) => c.scrollHeight > c.clientHeight), `I ${name}: Chapter 3's steps and action fit or scroll inside the card`);
    await p.click('.story-find');
    const fb = await p.$eval('#landing', (e) => e.getBoundingClientRect().toJSON());
    ok(fb.top <= 1 && fb.bottom >= viewport.height - 1 && await p.isVisible('.finder-hide'), `I ${name}: the finder opens as a full-height sheet with "Back to the story"`);
    await search(p, '00101');
    ok(await inView(p, 'a.finder-site'), `I ${name}: Visit Campaign Website on screen in the sheet`);
    await p.screenshot({ path: `${out}/I_${name.replace(' ', '_')}_finder_in_story.png` });
    await p.click('.finder-hide');
    ok((await pos(p)).beatId === 'steps', `I ${name}: back to the same beat`);
    ok(await noSideScroll(p), `I ${name}: no sideways scrolling`);
    ok(errors.length === 0, `I ${name}: no page errors ` + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ J. with the 3D map; K. no WebGL
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium', { reducedMotion: 'reduce', waitMap: true });
    ok(await inView(p, '#zip') && await inView(p, '#exploreBtn'), 'J: map on: both entry points on screen');
    ok(!(await p.isVisible('#descend')) && !(await p.isVisible('#pinMaple')), 'J: Maple Hollow’s separate entrance is off (one Toy Town entrance)');
    await p.waitForSelector('#pinToy:not([hidden])');
    const d0 = await p.evaluate(() => window.__nat.rig.dist);
    await p.click('#pinToy');
    await p.waitForSelector('#story:not([hidden])', { timeout: 300000 });   // Phase 1: after the flight down (a fade here: reduced motion)
    ok(await p.isVisible('#story'), 'J: the Toy Town star on the map opens the story');
    await p.click('.story-find'); await search(p, '00201'); await p.click('.finder-hide');
    await p.click('.story-exit');
    await p.waitForFunction(() => window.__nat.state().mode === 'national', null, { timeout: 300000 }); await p.waitForTimeout(1500);
    const c = await p.evaluate(() => window.__nat.campaign());
    ok(c.selected && c.visible && await p.evaluate(() => window.__nat.rig.dist) < d0 * 0.6, 'J: back on the map, it frames the campaign chosen inside the story and pins it');
    ok(errors.length === 0, 'J: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium&maplehollow=1', { reducedMotion: 'reduce', waitMap: true });
    await p.waitForSelector('#descend:not([hidden])');
    ok(await p.isVisible('#descend'), 'J: ?maplehollow=1 brings Maple Hollow’s entrance back (kept, reversible)');
    ok(errors.length === 0, 'J maplehollow: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, '', { noWebGL: true });
    await p.waitForFunction(() => /could not load/.test(document.getElementById('status')?.textContent || ''));
    await search(p, '00101');
    ok(await p.isVisible('a.finder-site'), 'K: no WebGL: the finder works');
    await p.click('#exploreBtn'); await nextTimes(p, 3);
    ok((await pos(p)).chapterId === 'how' && await p.isVisible('.story-scene img'), 'K: no WebGL: the story works (placeholder scenes are images)');
    ok(errors.length === 0, 'K: no uncaught page errors ' + errors.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
