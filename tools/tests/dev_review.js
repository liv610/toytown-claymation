// The development review panel (?dev=1): visitors never get it, and its links and controls drive the real story clock.
//   URL=… node tools/tests/dev_review.js OUTDIR
// A. no ?dev: no panel, no dev chunk downloaded, no __natDev
// B. ?dev=1&at=lidGo+0.8&view=lid-open-side: opens paused at that exact moment, inspection camera on; play advances the
//    clock, pause holds it; a frame step moves 1/24 s; Replay collection starts the beat from its first frame
// C. ?dev=1&frame=phone: the stage is framed at the phone's proportions and the scene uses its tall composition
// D. ?dev=1&story=how/pickup: the visitor's own story opens at that beat (card and controls)
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const LONG = 600000;
async function open(b, query, viewport = { width: 1280, height: 720 }) {
  const ctx = await b.newContext({ viewport }); const p = await ctx.newPage(); p.setDefaultTimeout(LONG);
  const errors = [], chunks = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('request', (r) => chunks.push(r.url()));
  await p.goto(BASE + '?' + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__nat, null, { timeout: LONG, polling: 500 });
  return { ctx, p, errors, chunks };
}
const st = (p) => p.evaluate(() => window.__natDev.state());

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  {
    const { ctx, p, errors, chunks } = await open(b, 'capture=1&q=medium');
    await p.waitForTimeout(1500);
    ok(await p.$('.devp') === null && await p.evaluate(() => !window.__natDev && !document.body.classList.contains('dev-review')), 'A: without ?dev=1 there is no review panel and no __natDev');
    ok(!chunks.some((u) => /dev_review/.test(u)), 'A: the dev chunk is not downloaded by visitors');
    ok(errors.length === 0, 'A: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium&dev=1&at=lidGo%2B0.8&view=lid-open-side');
    await p.waitForSelector('.devp');
    const T = await p.evaluate(() => window.__natDev.times()), s0 = await st(p);
    ok(Math.abs(s0.t - (T.lidGo + 0.8)) < 1e-3 && !s0.playing && s0.mode === 'scene', `B: the link opens paused at lidGo+0.8 (${s0.t.toFixed(3)} s)`);
    ok(await p.$eval('[data-k="view"]', (e) => e.value) === 'lid-open-side', 'B: the inspection camera from the link is selected');
    await p.screenshot({ path: `${out}/B_lid_open_side.jpg`, timeout: LONG });
    await p.keyboard.press('ArrowRight'); const s1 = await st(p);
    ok(Math.abs(s1.t - s0.t - 1 / 24) < 1e-3, 'B: → steps one frame (1/24 s)');
    await p.evaluate(() => window.__natDev.rate(4)); await p.click('[data-k="play"]');
    await p.waitForFunction((t) => window.__natDev.state().t > t + 0.2, s1.t, { timeout: LONG, polling: 200 });
    ok((await st(p)).playing, 'B: Play advances the story clock');
    await p.click('[data-k="play"]'); const a = (await st(p)).t; await p.waitForTimeout(1500); const s2 = await st(p);
    ok(!s2.playing && Math.abs(s2.t - a) < 1e-6, 'B: Pause holds the moment');
    const q = new URLSearchParams(await p.evaluate(() => location.search));
    ok(q.get('dev') === '1' && Math.abs(+q.get('t') - s2.t) < 2e-3 && q.get('view') === 'lid-open-side', `B: the address is a link back to the paused moment (${q})`);
    await p.click('[data-beat="collection"]'); const B = await p.evaluate(() => window.__natDev.beats()), s3 = await st(p);
    ok(s3.playing && s3.t - B.collection[0] < 0.5 && Math.abs(s3.to - B.collection[1]) < 1e-6, 'B: Replay collection plays the beat from its start to its end');
    ok(errors.length === 0, 'B: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium&dev=1&frame=phone&at=lid1');
    await p.waitForSelector('.devp');
    const r = await p.$eval('#stage', (e) => { const b = e.getBoundingClientRect(); return b.width / b.height; });
    ok(Math.abs(r - 390 / 844) < 0.01, `C: the phone composition frames the stage at 390:844 (${r.toFixed(3)})`);
    await p.screenshot({ path: `${out}/C_phone_lid1.jpg`, timeout: LONG });
    ok(errors.length === 0, 'C: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium&dev=1&story=how/pickup');
    await p.waitForFunction(() => window.__natShell.story.isOpen(), null, { timeout: LONG });
    const pos = await p.evaluate(() => window.__natShell.story.position());
    ok(pos.chapterId === 'how' && pos.beatId === 'pickup', `D: the story opens at how/pickup (${pos.chapterId}/${pos.beatId})`);
    ok(await p.isVisible('.story-card') || await p.isVisible('#story'), 'D: the story card is shown');
    ok(errors.length === 0, 'D: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
})();
