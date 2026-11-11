// Handmade style test: measure all three styles under identical conditions (Hero view, same size), with and
// without the post passes, felt with and without fibre shells.
//   node tools/tests/handmade_measure.js OUTFILE.json [W] [H]
// Frame times come from SwiftShader (CPU) on the cloud machines: use them only to rank configurations against each
// other, never as real-device numbers. Triangles, draw calls and memory counts are exact.
const { chromium } = require('playwright'); const fs = require('fs');
const [out, W = '1280', H = '720'] = process.argv.slice(2);
const CONFIGS = [
  ['paper', 'style=paper'], ['paper, no AO/DOF', 'style=paper&ao=0&dof=0'],
  ['felt (5 shells)', 'style=felt&fuzz=5'], ['felt, no AO/DOF', 'style=felt&fuzz=5&ao=0&dof=0'], ['felt, no shells', 'style=felt&fuzz=0'],
  ['textile', 'style=textile'], ['textile, no AO/DOF', 'style=textile&ao=0&dof=0'],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const res = [];
  for (const [name, q] of CONFIGS) {
    const p = await b.newPage({ viewport: { width: +W, height: +H } });
    p.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
    await p.goto((process.env.TT_URL || 'http://localhost:8765') + `/handmade/index.html?capture=1&dpr=1&along=0.1&${q}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 600000, polling: 500 });
    const r = await p.evaluate(() => { window.__hm.goCam('Hero', true); window.__hm.timeFrames(2); const m = window.__hm.timeFrames(5); const i = window.__hm.renderer.info;
      return { ...m, programs: i.programs.length, textures: i.memory.textures, geometries: i.memory.geometries }; });
    res.push({ name, query: q, ...r });
    console.log(name.padEnd(22), `${r.ms.toFixed(0)} ms (SwiftShader)`, `${(r.drawnTris / 1e6).toFixed(2)}M tris/frame`, `${r.calls} calls`, `${(r.sceneTris / 1e6).toFixed(2)}M scene tris`, `build ${r.buildMs} ms`, `${r.programs} programs`);
    await p.close();
  }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  await b.close();
})();
