const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [out, cams, w, h] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const logs = []; p.on('pageerror', e => logs.push('ERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  await p.goto((process.env.TT_URL || 'http://localhost:8765') + '/hq/index.html?capture=1' + (process.env.QS || ''));
  await p.waitForFunction('window.__ready === true || window.__err', null, { timeout: 400000, polling: 1000 }).catch(e => logs.push('timeout'));
  for (const c of cams.split(',')) for (const m of (process.env.MODES || 'before,after').split(',')) {
    const r = await p.evaluate(`window.__shot(${JSON.stringify(c)}, '${m}', ${w}, ${h})`);
    fs.writeFileSync(`${out}/${c}_${m}.jpg`, Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(c, m, r.calls, r.tris);
  }
  console.log(logs.slice(0, 8).join('\n'));
  await b.close();
})();
