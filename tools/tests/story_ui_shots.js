// QUICK review of the story interface in context: the visitor's own story (card, controls, progress) over the live
// scene, at chosen beats and story moments, at desktop and phone sizes. One page load per size.
//   node tools/tests/story_ui_shots.js OUTDIR
//   SHOTS='how/collect@8.5,how/pickup@20.4'   chapter/beat@story-time (default: the donation and collection moments)
//   SIZE=desktop,phone,phone-short             (default: all three)   URL=…/national/index.html
// It uses the development hooks (?dev=1) only to place the clock; the dev panel itself is hidden from the shots.
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2] || 'dist/story-ui'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 844 }, 'phone-short': { width: 375, height: 667 } };
const SHOTS = (process.env.SHOTS || 'what/welcome@0,how/collect@8.5,how/collect@9.85,how/collect@13.5,how/pickup@20.4,how/pickup@24.5,request/help@0')
  .split(',').map((s) => { const [b, t] = s.split('@'); const [c, beat] = b.split('/'); return { c, beat, t: +t, name: `${c}-${beat}-${t}` }; });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const size of (process.env.SIZE || 'desktop,phone,phone-short').split(',')) {
    const ctx = await b.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, hasTouch: size !== 'desktop', isMobile: size !== 'desktop' });
    const p = await ctx.newPage(); p.setDefaultTimeout(600000);
    p.on('pageerror', (e) => console.error('page error:', e.message));
    await p.goto(BASE + '?dev=1&capture=1&q=medium', { timeout: 600000 });
    await p.waitForFunction(() => window.__natDev && document.querySelector('.devp'), null, { timeout: 600000, polling: 500 });
    await p.addStyleTag({ content: '.devp { display: none !important; }' });
    for (const s of SHOTS) {
      await p.evaluate(({ c, beat, t }) => { window.__natDev.seek(t); window.__natShell.story.goTo(c, beat); }, s);
      await p.waitForTimeout(2500);                                   // the beat starts after a short dip: let it, then hold the moment
      for (let k = 0; k < 6; k++) {                                   // the beat's entry dip can outlast the wait under SwiftShader and
        await p.evaluate(({ t }) => window.__natDev.seek(t), s);       // rewind the clock to the beat's start: seek until the time holds
        await p.waitForTimeout(1200);
        if (await p.evaluate(({ t }) => Math.abs(window.__natDev.state().t - t) < 0.05, s)) break;
      }
      await p.waitForTimeout(400);                                   // captions and transitions settle (SwiftShader can hold the page
      await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 120000, polling: 250 }).catch(() => {});   // up: wait for them)
      const f = path.join(out, `${s.name}_${size}.jpg`);
      await p.screenshot({ path: f, type: 'jpeg', quality: 86, timeout: 600000 });
      console.log(f);
    }
    await ctx.close();
  }
  await b.close();
})();
