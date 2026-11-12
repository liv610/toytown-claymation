const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1100, height: 650 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8768/national.html?capture=1&q=medium'); await p.waitForFunction(() => window.__nat, null, { timeout: 300000 });
  await p.evaluate(() => window.__nat.story(8.5, true)); await p.waitForTimeout(300); await p.screenshot({ path: process.argv[2] });
  console.log('caption:', await p.textContent('#caption')); console.log('ERRORS', JSON.stringify(errs)); await b.close(); })();
