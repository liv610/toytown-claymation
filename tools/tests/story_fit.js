// QUICK check of the story interface's fit and legibility on phones (and desktop), in the real story over the live scene:
//   - safe areas: with notch/home-indicator insets emulated (Chromium's own safe-area override), every control and line of
//     text lies inside the safe area and on screen;
//   - the top bar and the captions never overlap; the chapter's name is never cut off;
//   - contrast: every piece of interface text, in its own colour and opacity (dimmed while a beat plays, or not), against
//     the actual pixels behind it (the scene through the veils, text hidden). Without its shadow, to be conservative.
//     WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text (24 px, or 18.66 px bold).
//   node tools/tests/story_fit.js [OUTDIR]       URL=…/national/index.html   SIZE=phone-notch,…   SHOTS=how/collect@8.5,…
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const sharp = require(path.resolve(__dirname, '../../web/node_modules/sharp'));
const out = process.argv[2] || 'dist/story-fit'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = {
  desktop: { vp: [1280, 720], ins: null },
  'phone-notch': { vp: [390, 844], ins: { top: 47, bottom: 34, left: 0, right: 0 }, mobile: true },
  'phone-short': { vp: [375, 667], ins: { top: 20, bottom: 0, left: 0, right: 0 }, mobile: true },
  'phone-narrow': { vp: [320, 568], ins: { top: 20, bottom: 0, left: 0, right: 0 }, mobile: true },
  'landscape-notch': { vp: [844, 390], ins: { top: 0, bottom: 21, left: 47, right: 47 }, mobile: true },
  'landscape-short': { vp: [667, 375], ins: { top: 0, bottom: 0, left: 0, right: 0 }, mobile: true },
};
const SHOTS = (process.env.SHOTS || 'how/collect@8.5,how/pickup@20.4,request/steps@0,what/welcome@0')
  .split(',').map((s) => { const [b, t] = s.split('@'); const [c, beat] = b.split('/'); return { c, beat, t: +t, name: `${c}-${beat}-${t}` }; });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const size of (process.env.SIZE || Object.keys(SIZES).join(',')).split(',')) {
    const S = SIZES[size];
    const ctx = await b.newContext({ viewport: { width: S.vp[0], height: S.vp[1] }, deviceScaleFactor: 1, hasTouch: !!S.mobile, isMobile: !!S.mobile });
    const p = await ctx.newPage(); p.setDefaultTimeout(600000);
    p.on('pageerror', (e) => ok(false, `${size}: page error ${e.message}`));
    if (S.ins) await (await ctx.newCDPSession(p)).send('Emulation.setSafeAreaInsetsOverride', { insets: S.ins });
    await p.goto(BASE + '?dev=1&capture=1&q=medium', { timeout: 600000 });
    await p.waitForFunction(() => window.__natDev && document.querySelector('.devp'), null, { timeout: 600000, polling: 500 });
    await p.addStyleTag({ content: '.devp { display: none !important; }' });
    const ins = S.ins || { top: 0, bottom: 0, left: 0, right: 0 };
    for (const s of SHOTS) {
      await p.evaluate(({ c, beat, t }) => { window.__natDev.seek(t); window.__natShell.story.goTo(c, beat); }, s);
      await p.waitForTimeout(2500);
      await p.evaluate(({ t }) => window.__natDev.seek(t), s);
      await p.waitForTimeout(1200);
      await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 120000, polling: 250 }).catch(() => {});
      const tag = `${size} ${s.name}`;
      await p.screenshot({ path: path.join(out, `${s.name}_${size}.jpg`), type: 'jpeg', quality: 84 });
      // ---- geometry
      const geo = await p.evaluate((ins) => {
        const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]'); };
        const els = [...document.querySelectorAll('#story button, #story .story-line, #story .story-eyebrow, #story .story-chapter-name, #story .story-tags, #story .story-list li, #story .story-note')].filter(vis);
        const W = innerWidth, H = innerHeight, out = [];
        for (const e of els) { const r = e.getBoundingClientRect();
          if (r.left < ins.left - 0.5 || r.right > W - ins.right + 0.5 || r.top < ins.top - 0.5 || r.bottom > H - ins.bottom + 0.5) out.push(`${e.className || e.tagName} [${r.left|0},${r.top|0},${r.right|0},${r.bottom|0}]`); }
        const bar = document.querySelector('.story-bar').getBoundingClientRect(), card = document.querySelector('.story-card').getBoundingClientRect();
        const barBottom = Math.max(...[...document.querySelectorAll('.story-bar *')].filter(vis).map((e) => e.getBoundingClientRect().bottom));
        const cardTop = Math.min(...[...document.querySelectorAll('.story-card > *')].filter(vis).map((e) => e.getBoundingClientRect().top));
        const nm = document.querySelector('.story-chapter-name'), cut = [...nm.children, nm].some((e) => vis(e) && e.scrollWidth > e.clientWidth + 1);
        const nmR = nm.getBoundingClientRect(), act = document.querySelector('.story-bar-actions').getBoundingClientRect();
        const clash = nmR.right > act.left + 1 && nmR.bottom > act.top && nmR.top < act.bottom;
        const scrolls = document.querySelector('.story-card').scrollHeight > document.querySelector('.story-card').clientHeight + 1;
        return { outside: out, gap: cardTop - barBottom, cut, clash, name: nm.textContent, scrolls };
      }, ins);
      ok(geo.outside.length === 0, `${tag}: every control and line is inside the safe area${geo.outside.length ? ' — outside: ' + geo.outside.join('; ') : ''}`);
      ok(geo.gap > 8, `${tag}: the captions and the top bar don't touch (gap ${geo.gap.toFixed(0)} px)`);
      ok(!geo.cut && !geo.clash, `${tag}: the chapter name is whole ("${geo.name}")${geo.cut ? ' — CUT' : ''}${geo.clash ? ' — runs into the actions' : ''}`);
      ok(!geo.scrolls, `${tag}: the caption area needs no scrolling as a whole (long beats scroll their text only)`);
      // ---- contrast, in both play states
      for (const st of (s.beat === 'collect' || s.beat === 'pickup') ? ['is-playing', 'is-ready'] : ['is-ready']) {
        const items = await p.evaluate((st) => {
          const root = document.getElementById('story'); root.classList.remove('is-playing', 'is-ready', 'is-paused'); root.classList.add(st);
          const pb = root.querySelector('.story-pause'); pb.hidden = st !== 'is-playing';
          for (const a of document.getAnimations()) a.finish();
          root.querySelectorAll('*').forEach((n) => { n.style.transition = 'none'; });
          const pick = [...root.querySelectorAll('.story-bar-actions button, .story-chapter-name span, .story-eyebrow, .story-line, .story-list li, .story-note, .story-nav button, .story-count, .story-links button, .story-tags')];
          const res = [];
          for (const e of pick) {
            const cs = getComputedStyle(e), rects = [];
            // the text's own boxes, leaving out screen-reader-only text (clipped away, not seen)
            const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.textContent.trim() || getComputedStyle(n.parentElement).clipPath === 'inset(50%)') continue;
              const rg = document.createRange(); rg.selectNodeContents(n); rects.push(...rg.getClientRects()); }
            const r = rects.filter((q) => q.width > 2 && q.height > 2).reduce((u, q) => u ? { left: Math.min(u.left, q.left), top: Math.min(u.top, q.top), right: Math.max(u.right, q.right), bottom: Math.max(u.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom }, null);
            if (!r) continue; r.width = r.right - r.left; r.height = r.bottom - r.top;   // (the text's own box, not the block's)
            if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden' || e.closest('[hidden]') || cs.display === 'none' || !e.textContent.trim()) continue;
            let op = 1; for (let n = e; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity;
            const m = cs.color.match(/[\d.]+/g).map(Number), size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
            // the button's own fill (if any) is part of the background: it stays in the screenshot
            res.push({ name: (e.className || e.tagName).split(' ')[0] + ' "' + e.textContent.trim().slice(0, 24) + '"', r: [r.left, r.top, r.width, r.height], c: m.slice(0, 3), a: (m[3] ?? 1) * op, large: size >= 24 || (bold && size >= 18.66) });
          }
          return res;
        }, st);
        await p.addStyleTag({ content: '#story .story-bar *, #story .story-card * { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; } #story svg { visibility: hidden !important; } #story .story-links button { text-decoration-color: transparent !important; }' });
        await p.waitForTimeout(400);
        const png = await p.screenshot({ type: 'png' });
        await p.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); s.remove(); document.querySelectorAll('#story *').forEach((n) => { n.style.transition = ''; }); });
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        for (const it of items) {
          const [x0, y0, w, h] = it.r.map(Math.round), L = [];
          for (let y = Math.max(0, y0); y < Math.min(info.height, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(info.width, x0 + w); x++) {
            const i = (y * info.width + x) * info.channels; L.push([data[i], data[i + 1], data[i + 2]]);
          }
          if (!L.length) continue;
          L.sort((u, v) => lum(...u) - lum(...v));
          const bg = L[Math.floor(L.length * 0.95)];                               // a bright patch behind the text (95th percentile)
          const fg = it.c.map((c, k) => c * it.a + bg[k] * (1 - it.a));
          const cr = ratio(lum(...fg), lum(...bg)), need = it.large ? 3 : 4.5;
          report.push({ size, shot: s.name, state: st, item: it.name, ratio: +cr.toFixed(2), need });
          ok(cr >= need, `${tag} ${st}: ${it.name} contrast ${cr.toFixed(2)}:1 (needs ${need})`);
        }
      }
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, 'contrast.json'), JSON.stringify(report, null, 1));
  const worst = report.sort((a, b) => a.ratio / a.need - b.ratio / b.need).slice(0, 8);
  console.log('lowest margins:'); for (const w of worst) console.log(`  ${w.ratio}:1 (needs ${w.need})  ${w.item}  ${w.size} ${w.shot} ${w.state}`);
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
})();
