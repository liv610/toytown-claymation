// Screenshots of the concept screens (concepts.html over the renders) into screens/.  Serve this folder on :8793, then
//   node shoot.js [prefix]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, 'screens'); fs.mkdirSync(OUT, { recursive: true });
const ALL = ['A_desktop_landing', 'A_desktop_found', 'A_phone_landing', 'A_phone_found', 'A_phone_details', 'B_desktop_landing', 'B_desktop_found', 'B_phone_landing', 'B_phone_found', 'B_phone_details'];
(async () => {
  const b = await chromium.launch();
  for (const s of ALL.filter((n) => !process.argv[2] || n.startsWith(process.argv[2]))) {
    const phone = s.includes('phone');
    const p = await b.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    await p.goto(`http://localhost:${process.env.PORT || 8793}/concepts.html?s=${s}`); await p.waitForSelector('body[data-ready]'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, s + '.png') }); console.log(s); await p.close();
  }
  await b.close();
})();
