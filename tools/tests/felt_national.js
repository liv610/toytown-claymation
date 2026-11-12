// The national map in felt vs clay, from the same cameras: the whole country, mid-descent, low over Ohio, Maple Hollow's
// street, and Chapter 1 at the drop-off box. Writes OUTDIR/<view>_<look>.jpg.
//   (cd web && npm run build:national && python3 -m http.server 8765)  then  node felt_national.js OUTDIR [views]
// SwiftShader (no GPU): not real-device frame rates.
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const want = (process.argv[3] || 'country,mid,low,street,story').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const look of (process.env.LOOKS || 'felt,clay').split(',')) {
    const p = await b.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
    const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto((process.env.TT_URL || 'http://localhost:8765') + `/national/index.html?capture=1&q=high&look=${look}`, { timeout: 600000 });
    await p.waitForFunction(() => window.__nat, null, { timeout: 900000, polling: 1000 });
    for (const v of want) {
      const url = await p.evaluate((v) => {
        const N = window.__nat;
        if (v === 'country') return N.shot(0);
        if (v === 'mid') return N.shot(0.55);
        if (v === 'low') return N.shot(0.82);
        if (v === 'street') return N.shot(1);
        return N.story(N.beats().hold + 1.2, true);
      }, v);
      fs.writeFileSync(`${out}/${v}_${look}.jpg`, Buffer.from(url.split(',')[1], 'base64')); console.log(look, v);
    }
    console.log(look, errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
    await p.close();
  }
  await b.close();
})();
