// The departure: your wrapped toy hops aboard a waiting train at the Toy Town station and the train
// pulls out of the shed. About 12 s; a pure function of time, so skip is exact. It drives one of the
// host's existing trains (red / blue / green route) through host.trains[i].override.
import { V, clamp, smooth, ramp, patch } from './diorama.js';

export const DEPARTURE_COPY = [
  { at: 0.4, text: 'Your toy is wrapped and waiting on the platform.' },
  { at: 2.6, text: 'All aboard: it’s joining the other toys on the Railroad of Hope…' },
  { at: 6.0, text: '…bound for the community you chose.' },
];

export function createDeparture(host, { onBeat, onEnd }) {
  const T = host.THREE;
  // the present: wrap colour set per gift, gold ribbon and bow, a soft halo so it reads as "yours"
  const gift = new T.Group(); host.scene.add(gift); gift.visible = false;
  const paper = new T.MeshStandardMaterial({ color: 0xc8342c, roughness: 0.55 }); patch(paper, 'clay', {}, true);
  const ribbon = new T.MeshStandardMaterial({ color: 0xf2d27a, roughness: 0.35, metalness: 0.3 });
  const S = 0.55;
  const box = new T.Mesh(new T.BoxGeometry(S, S * 0.8, S), paper); box.castShadow = true; gift.add(box);
  gift.add(new T.Mesh(new T.BoxGeometry(S * 1.02, S * 0.82, S * 0.16), ribbon), new T.Mesh(new T.BoxGeometry(S * 0.16, S * 0.82, S * 1.02), ribbon));
  for (const sg of [-1, 1]) { const loop = new T.Mesh(new T.TorusGeometry(S * 0.14, S * 0.05, 8, 16), ribbon); loop.position.set(sg * S * 0.12, S * 0.46, 0); loop.rotation.set(0, Math.PI / 2, sg * 0.6); gift.add(loop); }
  const halo = new T.Mesh(new T.RingGeometry(S * 0.75, S * 1.05, 40), new T.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false }));
  halo.rotation.x = -Math.PI / 2; gift.add(halo);
  const glow = new T.PointLight(0xffc070, 0, 5, 2); gift.add(glow);

  let tr = null, t = -1, running = false, beat = -1, plan = null;
  const S0 = 14, RUN = 120, T_HOP0 = 2.4, T_HOP1 = 3.5, T_GO = 4.2, END = 13;

  function setup(route, color) {
    tr = host.trains.find((x) => x.route === route) || host.trains[0];
    paper.color.set(color);
    const at = (x) => tr.curve.getPointAt(clamp(x / tr.L, 0, 1));
    const tan = (x) => tr.curve.getTangentAt(clamp(x / tr.L, 0, 0.999));
    const sideAt = (x) => { const t2 = tan(x); return V(-t2.z, 0, t2.x).normalize(); };
    const dist = (pose) => pose.pos.distanceTo(pose.look);
    // shot A, on the platform: a three-quarter view along the train, from whichever side is open
    const cS = S0 - 6.3, c = at(cS), tg = tan(cS);
    const giftSpot = (sg) => { const q = c.clone().addScaledVector(sideAt(cS), 1.9 * sg); q.y = host.groundAt(q.x, q.z, 3) + 0.3; return q; };
    const trainParts = new Set(host.trains.flatMap((x) => x.parts));
    const solids = host.scene.children.filter((o) => !o.isPoints && !o.isLight && o !== gift && !trainParts.has(o));   // incl. instanced columns
    const clearTo = (from, to) => { const d = to.clone().sub(from), L = d.length(); host.ray.set(from, d.normalize()); host.ray.far = L - 0.3; return !host.ray.intersectObjects(solids, true)[0]; };
    const shotA = (sg) => {
      // try a few spots along the platform; take the first with nothing (roof columns!) in front of the car or the present
      for (const ahead of [8.5, 6.5, 10.5, 5.0, 12.0, 7.5, 9.5, 4.0, 11.0, 13.5]) {
        const pose = host.clearPose({ pos: c.clone().addScaledVector(tg, ahead).addScaledVector(sideAt(cS), 5.2 * sg).add(V(0, 3.0, 0)), look: c.clone().addScaledVector(tg, 2.2).add(V(0, 0.6, 0)), fov: 50 });
        const g0 = giftSpot(sg), c0 = c.clone().add(V(0, 0.8, 0)), probes = [];
        for (let i = 0; i <= 16; i++) { probes.push(g0.clone().lerp(pose.look, i / 16), c0.clone().lerp(pose.look, i / 16), g0.clone().lerp(c0, i / 16)); }
        if (probes.every((q) => clearTo(pose.pos, q))) { console.debug('departure shot A ahead', ahead); return pose; }
      }
      return host.clearPose({ pos: c.clone().addScaledVector(tg, 8.5).addScaledVector(sideAt(cS), 5.2 * sg).add(V(0, 3.0, 0)), look: c.clone().addScaledVector(tg, 2.2).add(V(0, 0.6, 0)), fov: 50 });
    };
    const a1 = shotA(1), a2 = shotA(-1), sg = dist(a1) >= dist(a2) ? 1 : -1;
    // shot B, outside: the first point where the line has left the shed, watched from beside the track
    const shed = host.meta.shed;                              // Blender [x0, x1, y0, y1]
    const inside = (p) => p.x > shed[0] - 12 && p.x < shed[1] + 12 && -p.z > shed[2] - 12 && -p.z < shed[3] + 12;
    let sExit = S0; while (sExit < tr.L - 40 && inside(at(sExit))) sExit += 2;
    const shotB = (sb) => host.clearPose({ pos: at(sExit + 24).addScaledVector(sideAt(sExit + 24), 14 * sb).add(V(0, 6.5, 0)), look: at(sExit - 4).add(V(0, 1.4, 0)), fov: 50 });
    const b1 = shotB(1), b2 = shotB(-1);
    const carTop = (() => { tr.override = S0; host.frame(0); return new T.Box3().setFromObject(tr.parts[1]).max.y; })();
    plan = { at, tan, side: sideAt(cS).multiplyScalar(sg), carTop, A: sg > 0 ? a1 : a2, B: dist(b1) >= dist(b2) ? b1 : b2, sExit };
  }
  const T_CUT = 5.4;
  function evaluate(x) {
    const { at, tan, side, carTop, A, B, sExit } = plan;
    const sRun = x < T_GO ? S0 : S0 + RUN * Math.pow(clamp((x - T_GO) / (END - T_GO)), 1.8);
    tr.override = sRun;
    const carS = sRun - 6.3, car = at(carS), tg = tan(carS);
    // present: waits on the platform, then hops into the first car and rides with it
    const plat = at(S0 - 6.3).addScaledVector(side, 1.9); plat.y = host.groundAt(plat.x, plat.z, 3) + S * 0.4;
    const seat = car.clone(); seat.y = carTop + S * 0.4 - 0.05;
    const k = ramp(x, T_HOP0, T_HOP1);
    const p = plat.clone().lerp(seat, k); p.y += Math.sin(k * Math.PI) * 1.1;
    gift.position.copy(x < T_HOP1 ? p : seat);
    gift.rotation.y = Math.atan2(tg.x, tg.z) + (1 - k) * 0.6 + k * Math.PI * 2;
    halo.material.opacity = 0.55 * ramp(x, 0.2, 1.0);
    glow.intensity = 3 * ramp(x, 0.2, 1.0);
    if (x < T_CUT) { host.cur.pos.copy(A.pos); host.cur.look.copy(A.look); host.cur.fov = A.fov; }
    else {                                    // outside: hold the view, pan to follow the engine as it passes
      const eng = at(sRun).add(V(0, 1.2, 0));
      const k2 = smooth((sRun - (sExit - 10)) / 40);
      host.cur.pos.copy(B.pos); host.cur.look.copy(B.look).lerp(eng, clamp(k2)); host.cur.fov = B.fov;
    }
  }
  host.onUpdate((dt) => {
    if (!running) return;
    t = Math.min(END, t + dt); evaluate(t);
    for (let i = beat + 1; i < DEPARTURE_COPY.length; i++) if (t >= DEPARTURE_COPY[i].at) { beat = i; onBeat && onBeat(i, DEPARTURE_COPY[i].text); }
    if (t >= END) finish('complete');
  });
  function finish(reason) { running = false; if (tr) tr.override = null; gift.visible = false; onEnd && onEnd(reason); }
  return {
    duration: END, get time() { return t; }, get running() { return running; },
    start(route, color) { host.explore(null); host.cancelMove(); setup(route, color); t = 0; beat = -1; gift.visible = true; running = true; evaluate(0); },
    skip() { if (running) { t = END; evaluate(END); finish('skip'); } },
    // stills / tests
    seek(route, color, x) { setup(route, color); gift.visible = true; evaluate(x); },
    release() { running = false; if (tr) tr.override = null; gift.visible = false; },
  };
}
