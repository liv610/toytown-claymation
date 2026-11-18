// A video of the Milestone 2A scene: every frame rendered at its exact story time (headless SwiftShader is far too slow
// to record in real time), then encoded with ffmpeg.
//   URL=… SIZE=desktop|phone FPS=24 T0=0 T1=29.2 node tools/tests/scene_video.js OUTDIR   →  OUTDIR/<size>/f00000.jpg … + OUTDIR/<size>.mp4
const { chromium } = require('playwright'); const fs = require('fs'); const { execFileSync } = require('child_process');
const out = process.argv[2] || '.';
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
const SIZES = { desktop: { width: 1280, height: 720 }, phone: { width: 390, height: 844 } };
const size = process.env.SIZE || 'desktop', fps = +(process.env.FPS || 24), t0 = +(process.env.T0 || 0);
(async () => {
  const dir = `${out}/${size}`; fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: SIZES[size], deviceScaleFactor: size === 'phone' ? 2 : 1 }); p.setDefaultTimeout(600000);
  await p.goto(BASE + `?capture=1&q=${process.env.Q || 'medium'}`, { timeout: 600000 });
  await p.waitForFunction(() => window.__nat, null, { timeout: 600000, polling: 500 });
  const t1 = +(process.env.T1 || await p.evaluate(() => window.__nat.sceneEnd()));
  const n = Math.round((t1 - t0) * fps);
  for (let i = 0; i <= n; i++) {
    const f = `${dir}/f${String(i).padStart(5, '0')}.jpg`;
    if (fs.existsSync(f)) continue;                                  // resumable
    const url = await p.evaluate((t) => window.__nat.sceneFrame(t), t0 + i / fps);
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    if (i % 48 === 0) console.log(size, i, '/', n);
  }
  await b.close();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${dir}/f%05d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', `${out}/${size}.mp4`]);
  console.log('wrote', `${out}/${size}.mp4`);
})();
