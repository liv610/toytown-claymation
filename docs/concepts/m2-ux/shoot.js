// Screenshots of the concept screens (concepts.html over the renders and stills) into screens/.
// Serve the repository root on :8794 (python3 -m http.server 8794), then  node shoot.js [prefix]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'screens'); fs.mkdirSync(OUT, { recursive: true });
const PAGE = `http://localhost:${process.env.PORT || 8794}/docs/concepts/m2-ux/concepts.html`;
(async () => {
  const b = await chromium.launch();
  const p0 = await b.newPage(); await p0.goto(PAGE + '?s=SA_1d'); await p0.waitForFunction(() => window.SCREENS);
  const list = await p0.evaluate(() => window.SCREENS.map((s) => [s, window.SIZE(s)])); await p0.close();
  for (const [s, [w, h]] of list.filter(([n]) => !process.argv[2] || n.startsWith(process.argv[2]))) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${PAGE}?s=${s}`); await p.waitForSelector('body[data-ready]', { state: 'attached', timeout: 30000 }).catch(() => errs.push('not ready'));
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(OUT, s + '.png') }); console.log(s, w + '×' + h, errs.join(' | ')); await p.close();
  }
  await b.close();
})();
