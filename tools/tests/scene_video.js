// A video of the Milestone 2A scene: every frame rendered at its exact story time (headless SwiftShader is far too slow
// to record in real time), then encoded with ffmpeg.
//   URL=… SIZE=desktop|phone FPS=24 T0=0 T1=29.2 node tools/tests/scene_video.js OUTDIR   →  OUTDIR/<size>/f00000.jpg … + OUTDIR/<size>.mp4
//
// FULL review only. The whole sequence takes about 1.5 h per size here (SwiftShader), so a run without T0/T1 refuses to
// start unless FULL=1 is set. For a moment under review, render a short clip instead (minutes), e.g.
//   T0=lid0-0.5 T1=lidGo+1.5 FPS=12 DPR=1 SIZE=desktop node tools/tests/scene_video.js dist/clip
// T0/T1 take seconds or timeline marks (lid0, lidGo, door0 … ± seconds). DPR: phone frames default to 2 (crisp review
// videos); 1 is enough for a working clip. Output name: <size>.mp4, or <size>_<T0>_<T1>.mp4 for a clip.
const { chromium } = require('playwright'); const fs = require('fs'); const { execFileSync } = require('child_process');
const out = process.argv[2] || '.';
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 844 } };
const size = process.env.SIZE || 'desktop', fps = +(process.env.FPS || 24);
const clip = !!(process.env.T0 || process.env.T1);
if (!clip && process.env.FULL !== '1') {
  console.error('scene_video.js: a full-length render takes about 1.5 hours per size. Set FULL=1 for a milestone video, or T0/T1 for a short clip (see the header).');
  process.exit(2);
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: +(process.env.DPR || (size === 'phone' ? 2 : 1)) }); p.setDefaultTimeout(600000);
  await p.goto(BASE + `?capture=1&q=${process.env.Q || 'medium'}`, { timeout: 600000 });
  await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
  const T = await p.evaluate(() => window.__nat.sceneTimes());
  const at = (v) => { if (!isNaN(+v)) return +v; const m = /^(\w+)\s*([+-][\d.]+)?$/.exec(v); if (!m || !(m[1] in T)) throw new Error(`unknown moment "${v}"`); return T[m[1]] + (m[2] ? +m[2] : 0); };
  const t0 = Math.max(0, at(process.env.T0 || 0));
  const t1 = process.env.T1 ? at(process.env.T1) : await p.evaluate(() => window.__nat.sceneEnd());
  const name = clip ? `${size}_${t0.toFixed(2)}_${t1.toFixed(2)}` : size;
  const dir = `${out}/${name}`; fs.mkdirSync(dir, { recursive: true });
  const n = Math.round((t1 - t0) * fps);
  for (let i = 0; i <= n; i++) {
    const f = `${dir}/f${String(i).padStart(5, '0')}.jpg`;
    if (fs.existsSync(f)) continue;                                  // resumable
    const url = await p.evaluate((t) => window.__nat.sceneFrame(t), t0 + i / fps);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    if (i % 48 === 0) console.log(size, i, '/', n);
  }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/f%05d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', `${out}/${name}.mp4`]);
  console.log('wrote', `${out}/${name}.mp4`);
})();
