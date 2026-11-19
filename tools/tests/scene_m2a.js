// Milestone 2A: the red truck's donation and collection, animated (experiment/milestone2a).
// Headless Chromium + SwiftShader (no GPU: a frame can take seconds, so the story clock is sped up with a test-only hook
// for the control checks; nothing here measures real-device speed).   URL=… node tools/tests/scene_m2a.js OUTDIR
// A. the scene itself, sampled every 1/30 s (no rendering): the truck never jumps, it stays with the child, the box or
//    the carton; people keep clear of each other, the box, the wall and the door; the camera moves smoothly between cuts
// B. the story in the page: Chapter 2 plays; the beat waits at its end; the finder freezes the story at that moment and
//    resumes it; Next mid-animation resolves it (fast-forward) or dips; Back replays from the start; Skip; Exit
// C. reduced motion: the animation still plays; the camera holds steady compositions
// D. no 3D: the beats show their stills
const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2] || '.'; fs.mkdirSync(out, { recursive: true });
const BASE = process.env.URL || 'http://localhost:8765/national/index.html';
// ONLY=A (or A,C …) runs just those sections while iterating; the full run (no ONLY) is the milestone check
const ONLY = (process.env.ONLY || '').toUpperCase().split(',').filter(Boolean), run = (sec) => !ONLY.length || ONLY.includes(sec);
let failed = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
const LONG = 600000;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

async function open(b, query, { reducedMotion = 'no-preference', viewport = { width: 1280, height: 720 }, waitMap = true } = {}) {
  const ctx = await b.newContext({ viewport, reducedMotion });
  await ctx.route(/example\.org|toysfortots\.org/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>outbound</title>' }));
  const p = await ctx.newPage(); const errors = []; p.setDefaultTimeout(LONG);
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(BASE + '?' + query, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__natShell);
  if (waitMap) await p.waitForFunction(() => window.__natWorld && window.__nat, null, { timeout: LONG, polling: 500 });
  return { ctx, p, errors };
}
const sc = (p) => p.evaluate(() => window.__nat.scene());
const pos = (p) => p.evaluate(() => { const s = window.__natShell.story.position(); return s && `${s.chapterId}/${s.beatId}`; });
const until = (p, fn, arg) => p.waitForFunction(fn, arg, { timeout: LONG, polling: 200 });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ------------------------------------------------------------ A. the scene, sampled
  if (run('A')) {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium');
    const info = await p.evaluate(() => { const s = window.__nat.scene(); return s; });
    ok(info && info.chimneys >= 3, `A: chimneys found for the smoke (${info && info.chimneys})`);
    const tr = await p.evaluate(() => window.__nat.sceneTrace(0, 28.4, 1 / 30));
    const trTall = await p.evaluate(() => window.__nat.sceneTrace(0, 28.4, 1 / 30, true));
    fs.writeFileSync(`${out}/trace.json`, JSON.stringify(tr.filter((_, i) => i % 6 === 0)));
    // the truck: never a jump bigger than a fall would make in 1/30 s (town units: the fall is about 0.35 in 0.32 s)
    // (puppets move on twos, so a move is a step every 1/12 s; the fall into the box, inside it, is the one fast moment)
    // A jump is the truck moving apart from whoever holds it. Measured against its carrier (the child until it is let go,
    // the Marine once he grips the carton): the truck's step minus the carrier's step. A walking carrier on twos moves
    // ~0.1 a step, so the absolute step is only bounded loosely; against the carrier, 0.1 a step (1.2 units/s on twos: the
    // carton lifted out of the box) is the fastest real move. A teleport would be several times that.
    const TT = await p.evaluate(() => window.__nat.sceneTimes());
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    let maxStep = 0, at = 0, fall = 0, maxRel = 0, relAt = 0;
    for (let i = 1; i < tr.length; i++) {
      const t = tr[i].t, d = dist3(tr[i].truck, tr[i - 1].truck);
      if (t > 9.65 && t < 10.15) { fall = Math.max(fall, d); continue; }
      if (d > maxStep) { maxStep = d; at = t; }
      const who = t < TT.lift0 ? 'child' : t > TT.grip + 0.05 ? 'marine' : null;
      if (who) { const r = dist3(sub(tr[i].truck, tr[i][who]), sub(tr[i - 1].truck, tr[i - 1][who])); if (r > maxRel) { maxRel = r; relAt = t; } }
    }
    ok(maxRel < 0.1 && maxStep < 0.16, `A: the red truck never jumps (largest move against its carrier in 1/30 s: ${maxRel.toFixed(3)} at ${relAt.toFixed(2)} s; largest move: ${maxStep.toFixed(3)} at ${at.toFixed(2)} s)`);
    ok(fall < 0.25, `A: its fall through the slot onto the toys is a short drop, not a jump (${fall.toFixed(3)})`);
    // where the truck is: with the child (beat 1), in the box (after the drop), with the carton (from the lift)
    const near = (s, k) => dist3(s.truck, s[k]);
    const withChild = tr.filter((s) => s.t > 2 && s.t < 9.3).every((s) => near(s, 'child') < 1.2);
    const inBox = tr.filter((s) => s.t > 10.2 && s.t < 20).every((s) => s.truck.y < 0.8 && Math.abs(s.truck.x - 2.3) < 0.5 && Math.abs(s.truck.z - 1.25) < 0.4);
    const onCarton = tr.filter((s) => s.t > 10.2).every((s) => dist3(s.truck, s.carton) < 0.55);
    ok(withChild, 'A: the truck stays in the child\'s arms until it goes into the box');
    ok(inBox, 'A: once dropped, the truck is inside the box until the Marine lifts the carton out');
    ok(onCarton, 'A: from the drop onward the truck rests on the toys in the carton (it is carried with it, never moved on its own)');
    const shown = tr.filter((s) => s.t < 23).every((s) => s.visible.truck);
    ok(shown, 'A: the truck is visible throughout, until it is carried into the hall');
    // people keep clear of each other (feet at least 0.35 apart), of the box and of the hall wall
    const people = ['child', 'parent', 'marine', 'volunteer'];
    let minPair = 9, pairAt = '';
    for (const s of tr) for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
      const a = s[people[i]], c = s[people[j]]; if (!s.visible.marine && (people[i] === 'marine' || people[j] === 'marine')) continue;
      const d = dist2(a, c); if (d < minPair) { minPair = d; pairAt = `${people[i]}/${people[j]} at ${s.t.toFixed(2)} s`; }
    }
    ok(minPair > 0.35, `A: nobody walks into anybody (closest: ${minPair.toFixed(2)}, ${pairAt})`);
    const boxHit = tr.find((s) => people.some((k) => Math.abs(s[k].x - 2.3) < 0.525 + 0.12 && Math.abs(s[k].z - 1.25) < 0.375 + 0.12));
    ok(!boxHit, 'A: nobody stands inside the drop-off box' + (boxHit ? ` (at ${boxHit.t.toFixed(2)} s)` : ''));
    const wallHit = tr.find((s) => people.some((k) => (k !== 'marine' || s.t < 21) && s[k].z < 0.2 && Math.abs(s[k].x) < 4.2));
    ok(!wallHit, 'A: nobody walks into the hall\'s wall (only the Marine goes in, through the doorway)' + (wallHit ? ` (at ${wallHit.t.toFixed(2)} s)` : ''));
    // the open door: the volunteer stands outside its swing; the Marine passes clear of it
    const doorSeg = (th) => { const h = { x: -0.7, z: 0.09 }, e = { x: -0.7 + 1.4 * Math.cos(th), z: 0.09 + 1.4 * Math.sin(th) }; return [h, e]; };
    const segDist = (pt, [a, c]) => { const vx = c.x - a.x, vz = c.z - a.z, k = Math.max(0, Math.min(1, ((pt.x - a.x) * vx + (pt.z - a.z) * vz) / (vx * vx + vz * vz))); return Math.hypot(pt.x - a.x - k * vx, pt.z - a.z - k * vz); };
    let doorMin = 9; for (const s of tr) if (s.door > 0.05) { doorMin = Math.min(doorMin, segDist(s.volunteer, doorSeg(s.door)), s.visible.marine ? segDist(s.marine, doorSeg(s.door)) : 9); }
    ok(doorMin > 0.22, `A: nobody walks through the open door (closest: ${doorMin.toFixed(2)})`);
    // the camera: smooth within shots (cuts only where the film cuts)
    for (const [name, t] of [['desktop', tr], ['phone', trTall]]) {
      let worst = 0, wAt = 0; for (let i = 1; i < t.length; i++) { if (t[i].seg !== t[i - 1].seg && t[i].cut) continue; const d = Math.hypot(...t[i].cam.map((v, k) => v - t[i - 1].cam[k])); if (d > worst) { worst = d; wAt = t[i].t; } }
      ok(worst < 0.02, `A ${name}: the camera glides (largest move within a shot in 1/30 s: ${(worst / 0.2).toFixed(3)} town units at ${wAt.toFixed(2)} s)`);
    }
    ok(errors.length === 0, 'A: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------ B. the story in the page (full motion)
  if (run('B')) {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium');
    await p.evaluate(() => { window.__natRate = 4; });                      // the story clock at 4× (test hook)
    await p.click('#exploreBtn'); await p.waitForSelector('#skipFlight:not([hidden])'); await p.click('#skipFlight');
    await until(p, () => window.__nat.state().mode === 'shot');
    await p.click('.story-step[data-chapter="1"]');
    await until(p, () => { const s = window.__nat.scene(); return s && s.playing && s.t > 0.5; });
    ok(await pos(p) === 'how/collect' && await p.evaluate(() => document.body.classList.contains('story-live')), 'B: Chapter 2 opens on the donation, played live in the street');
    // the finder freezes the story at that moment; closing resumes from it
    await until(p, () => window.__nat.scene().t > 4);
    await p.click('.story-find'); await p.waitForSelector('body.story-finder');
    const t1 = (await sc(p)).t; await p.waitForTimeout(2500); const t2 = (await sc(p)).t;
    ok(Math.abs(t2 - t1) < 1e-6, `B: the finder freezes the story at ${t1.toFixed(2)} s (still ${t2.toFixed(2)} s later)`);
    await p.click('.finder-hide');
    await until(p, (t) => window.__nat.scene().t > t + 0.2, t2);
    const t3 = (await sc(p)).t;
    ok(t3 > t2 && t3 < t2 + 6 && await pos(p) === 'how/collect', `B: closing the finder resumes from the same moment (${t2.toFixed(2)} → ${t3.toFixed(2)} s)`);
    // Next near the end of the donation: the rest of the action resolves quickly (fast-forward), then the collection follows
    await until(p, () => window.__nat.scene().t > 10.8);
    await p.click('.story-next');
    const ff = await sc(p);
    ok(ff.ff > 1, `B: Next near the end of a beat fast-forwards the rest of its action (×${(ff.ff || 0).toFixed(1)}) instead of cutting it off`);
    await until(p, () => { const s = window.__nat.scene(); return s.playing && s.from === 13.5 && s.t > 13.6; });
    ok(await pos(p) === 'how/pickup', 'B: …then the collection plays, carrying on from that moment');
    // the beat ends and waits
    await until(p, () => !window.__nat.scene().playing);
    const end2 = await sc(p);
    ok(Math.abs(end2.t - end2.to) < 1e-6, `B: the collection plays to its end (${end2.t.toFixed(2)} s) and waits for the visitor`);
    await p.waitForTimeout(1500);
    ok(Math.abs((await sc(p)).t - end2.to) < 1e-6 && await pos(p) === 'how/pickup', 'B: while waiting, the story does not move on by itself');
    await p.click('.story-next');
    await until(p, () => window.__natShell.story.position().beatId === 'sort');
    ok(await pos(p) === 'how/sort', 'B: Next then moves on to the next beat');
    // Back: the collection again, from its start (after a short dip)
    await p.click('.story-back');
    await until(p, () => { const s = window.__nat.scene(); return s.playing && s.from === 13.5 && s.t < 15; });
    const back = await sc(p);
    ok(await pos(p) === 'how/pickup' && back.t < 15, `B: Back replays the collection from its start (${back.t.toFixed(2)} s)`);
    // Back again mid-animation: the donation from the start
    await p.click('.story-back');
    await until(p, () => { const s = window.__nat.scene(); return s.playing && s.from === 0; });
    ok(await pos(p) === 'how/collect' && (await sc(p)).t < 2, 'B: Back during an animation replays the previous beat from its start');
    // Exit mid-animation: the rise to the country
    await p.click('.story-exit');
    await p.waitForSelector('#skipFlight:not([hidden])'); await p.click('#skipFlight');
    await until(p, () => window.__nat.state().mode === 'national');
    ok(await p.isHidden('#story') && !(await sc(p)).playing, 'B: Exit Toy Town during the animation rises back to the map; the story stops');
    ok(errors.length === 0, 'B: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  // Skip story from the middle of an animation
  if (run('B')) {
    const { ctx, p, errors } = await open(b, 'capture=1&q=medium', { reducedMotion: 'reduce' });
    await p.evaluate(() => { window.__natRate = 4; });
    await p.click('#exploreBtn'); await until(p, () => window.__nat.state().mode === 'shot');
    await p.click('.story-step[data-chapter="1"]');
    await until(p, () => { const s = window.__nat.scene(); return s && s.playing && s.t > 2; });
    const t0 = (await sc(p)).t; await until(p, (t) => window.__nat.scene().t > t + 0.3, t0);
    ok((await sc(p)).t > t0, 'C: reduced motion: the characters\' animation still plays');
    await p.click('.story-skip');
    await until(p, () => window.__nat.state().mode === 'finale');
    ok(await pos(p) === 'finale/yours' && !(await sc(p)).playing, 'B: Skip story during an animation goes to the finale');
    ok(errors.length === 0, 'C: no page errors ' + errors.join(' | '));
    await ctx.close();
  }
  // reduced motion: steady compositions (the camera only changes at shot boundaries)
  if (run('C')) {
    const { ctx, p } = await open(b, 'capture=1&q=medium', { reducedMotion: 'reduce' });
    const steady = await p.evaluate(() => { const tr = window.__nat.sceneTraceReduced(0, 28.4, 0.1); let moves = 0; for (let i = 1; i < tr.length; i++) if (tr[i].seg === tr[i - 1].seg && Math.hypot(...tr[i].cam.map((v, k) => v - tr[i - 1].cam[k])) > 1e-6) moves++; return moves; });
    ok(steady === 0, `C: reduced motion: the camera holds still within each shot (${steady} moving samples)`);
    await ctx.close();
  }

  // ------------------------------------------------------------ D. no 3D
  if (run('D')) {
    const { ctx, p, errors } = await open(b, 'map=off', { waitMap: false });
    await p.click('#exploreBtn'); await p.waitForSelector('#story:not([hidden])');
    await p.click('.story-step[data-chapter="1"]');
    ok(await p.isVisible('.story-scene img') && await pos(p) === 'how/collect', 'D: map off: the donation shows its still and its description');
    ok(/red toy truck/.test(await p.textContent('.story-scene-alt')), 'D: the scene description says what happens (for screen readers and without 3D)');
    ok(errors.length === 0, 'D: no page errors ' + errors.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log((ONLY.length ? `(sections ${ONLY.join(',')} only) ` : '') + (failed ? `${failed} FAILED` : 'all passed')); process.exit(failed ? 1 : 0);
})();
