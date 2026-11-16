// Review screenshots of the Phase 1 visitor flow (Milestone 1), desktop 1280×800 and phone 390×844 at 2× pixel density.
//   node tools/tests/visitor_flow_shots.js OUTDIR      (URL defaults to the dev server on :8765)
// Headless Chromium + SwiftShader: the map is posed (__nat.pose) before each map screenshot, because a live page
// screenshot of the running map stalls without a GPU. Reduced motion, so camera moves land at once.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, viewport] of SIZES) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const p = await ctx.newPage(); p.setDefaultTimeout(300000);
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}_${n}.png`, timeout: 300000 }); console.log('shot', name, n); };
    const pose = () => p.evaluate(() => window.__nat.pose({ ...window.__nat.rig }));
    await p.goto(BASE + '?q=medium', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__natShell && window.__nat, null, { timeout: 600000, polling: 500 });
    await p.waitForTimeout(1500);
    // 1. landing: the map with the two entry points
    await pose(); await shot('1_landing');
    // 2. Journey A: ZIP → the serving campaign's card (fictional test data)
    await p.fill('#zip', '00101'); await p.click('.finder-form [type="submit"]');
    await p.waitForSelector('.finder-card');
    await p.waitForFunction(() => window.__nat.state().mode === 'national', null, { timeout: 300000, polling: 250 });
    await p.waitForTimeout(1500); await pose(); await shot('2_campaign_found');
    // 3. Journey B: the story
    await p.click('#exploreBtn'); await p.waitForSelector('#story:not([hidden])');
    await shot('3_story_chapter1');
    await p.click('.story-step[data-chapter="2"]'); await p.click('.story-next');
    await p.waitForFunction(() => document.getElementById('story').dataset.beat === 'steps');
    await shot('4_story_chapter3_steps');
    await p.click('.story-act-finder'); await p.waitForSelector('body.story-finder');
    await shot('5_finder_over_story');
    await p.click('.finder-hide');
    await p.click('.story-skip'); await p.waitForFunction(() => document.getElementById('story').dataset.chapter === 'finale');
    await shot('6_finale');
    if (errors.length) console.log('page errors', name, errors);
    await ctx.close();
  }
  await b.close();
})();
