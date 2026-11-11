// The Marine's moment (about 15 s, never blocking anything):
//   a new toy has just been left at the drop-off box beside the toy shop; the Marine walks over,
//   lifts it out, pauses to look at it, carries it to the wagon where a second Marine is loading
//   donated toys, sets it in, and the town's lights warm up.
// Everything is a pure function of story time, so skip / replay / jump-to-end are exact.
// It reuses the existing Marine (model, clips, colours) and the Delivery sequence's rig helpers.
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { B, V, clamp, smooth, lerp, ramp, patch } from './diorama.js';

export const STORY_COPY = [
  { at: 0.5, text: 'Someone in Toy Town just left a new toy at the drop-off.' },
  { at: 'lift', text: 'Marines and volunteers help gather donated toys…' },
  { at: 'place', text: '…so they can be shared in time for the holidays.' },
];

export async function createMarineStory(host, village, { load, onBeat, onEnd }) {
  const T = host.THREE;
  const [mg, gg] = await Promise.all([load('marine.glb'), load('gift.glb')]);

  function makeMarine(colors) {
    const obj = skClone(mg.scene);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((m) => {
        const c = m.clone(); if (colors && colors[m.name]) c.color.set(colors[m.name]);
        patch(c, /Coat|Trouser/.test(m.name) ? 'felt' : 'clay', {}, true); return c;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    host.scene.add(obj);
    const mixer = new T.AnimationMixer(obj), acts = {};
    for (const name of ['Walk', 'WalkCarry', 'Idle', 'IdleCarry']) {
      const a = mixer.clipAction(mg.animations.find((c) => c.name === name)); a.play(); a.setEffectiveWeight(0); acts[name] = a;
    }
    const bones = {}; obj.traverse((o) => { if (o.isBone) bones[o.name.replace('.', '')] = o; });
    return { obj, mixer, acts, bones };
  }
  const A = makeMarine(null);
  const Bm = makeMarine({ rt_MarineSkin: 0x8a5a3c, rt_MarineCheek: 0x9a5848, rt_MarineHair: 0x1a120e });
  const gift = gg.scene; gift.traverse((o) => { if (o.isMesh) { o.castShadow = true; patch(o.material, 'clay', {}, true); } });
  host.scene.add(gift);
  const gbox = new T.Box3().setFromObject(gift), gH = gbox.max.y - gbox.min.y;

  // ---------------- rig helpers (from the Delivery sequence)
  const _q2 = new T.Quaternion();
  const setBoneWorldQuat = (bone, qw) => { bone.parent.getWorldQuaternion(_q2); bone.quaternion.copy(_q2.invert().multiply(qw)); bone.updateMatrixWorld(true); };
  const aimBone = (bone, from, to) => setBoneWorldQuat(bone, new T.Quaternion().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(new T.Quaternion())));
  const rotateBoneWorld = (bone, axis, ang) => setBoneWorldQuat(bone, new T.Quaternion().setFromAxisAngle(axis, ang).multiply(bone.getWorldQuaternion(new T.Quaternion())));
  function ikArm(M, side, target, pole, w) {
    if (w <= 0.001) return;
    const u = M.bones['upper_arm' + side], f = M.bones['forearm' + side], h = M.bones['hand' + side];
    const S = u.getWorldPosition(V()), E = f.getWorldPosition(V()), Wp = h.getWorldPosition(V());
    const a = S.distanceTo(E), b = E.distanceTo(Wp);
    const dv = target.clone().sub(S), d = clamp(dv.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3), dir = dv.normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const pl = pole.clone().sub(S); pl.sub(dir.clone().multiplyScalar(pl.dot(dir))).normalize();
    const En = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pl, a * sinA), Tg = S.clone().addScaledVector(dir, d);
    const q0 = u.quaternion.clone(); aimBone(u, E.sub(S).normalize(), En.clone().sub(S).normalize());
    u.quaternion.slerpQuaternions(q0, u.quaternion.clone(), w); u.updateMatrixWorld(true);
    const E2 = f.getWorldPosition(V()), W2 = h.getWorldPosition(V()), q1 = f.quaternion.clone();
    aimBone(f, W2.sub(E2).normalize(), Tg.sub(E2).normalize());
    f.quaternion.slerpQuaternions(q1, f.quaternion.clone(), w); f.updateMatrixWorld(true);
  }
  const axes = (M) => { const q = M.obj.quaternion; return { fwd: V(0, 0, 1).applyQuaternion(q), left: V(1, 0, 0).applyQuaternion(q) }; };
  const GROUND = 0.06;
  function poseMarine(M, s, tc) {
    M.obj.position.set(s.p.x, GROUND, s.p.z); M.obj.rotation.set(0, s.yaw, 0); M.obj.updateMatrixWorld(true);
    const walkW = smooth(s.speed / 0.45), c = clamp(s.carry);
    const Wt = { Walk: walkW * (1 - c), WalkCarry: walkW * c, Idle: (1 - walkW) * (1 - c), IdleCarry: (1 - walkW) * c };
    const wd = M.acts.Walk.getClip().duration, id = M.acts.Idle.getClip().duration;
    for (const [k, a] of Object.entries(M.acts)) { a.setEffectiveWeight(Wt[k]); a.time = k.startsWith('Walk') ? (((s.phase % 1) + 1) % 1) * wd : (tc % id); }
    M.mixer.update(0); M.obj.updateMatrixWorld(true);
  }
  const CARRY_OFS = V(-0.06, 0.115, -0.02), CARRY_YAW = 0.25;
  function carryXform(M) {
    const local = M.obj.worldToLocal(M.bones.handL.getWorldPosition(V())).add(CARRY_OFS);
    return { p: M.obj.localToWorld(local), q: M.obj.quaternion.clone().multiply(new T.Quaternion().setFromAxisAngle(V(0, 1, 0), CARRY_YAW)) };
  }
  // trapezoid speed profile
  function travel(t, t0, L, v, e = 0.7) {
    const Tt = L / v + e, a = v / e;
    if (t <= t0) return { s: 0, v: 0 };
    const u = t - t0;
    if (u >= Tt) return { s: L, v: 0 };
    if (u < e) return { s: 0.5 * a * u * u, v: a * u };
    if (u > Tt - e) { const r = Tt - u; return { s: L - 0.5 * a * r * r, v: a * r }; }
    return { s: 0.5 * a * e * e + v * (u - e), v };
  }
  const yawOf = (d) => Math.atan2(d.x, d.z);
  const angLerp = (a, b, k) => { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; };
  const path = (pts) => new T.CatmullRomCurve3(pts.map(([x, y]) => B(x, y, 0)), false, 'centripetal');

  // ---------------- the script
  const START = B(-1.4, -2.75), P1 = B(3.12, -1.74), P2 = B(7.25, -3.4), BPOS = B(8.95, -3.25);
  const PA1 = path([[-1.4, -2.75], [0.6, -3.0], [2.5, -2.75], [3.45, -2.2], [3.12, -1.74]]), L1 = PA1.getLength();   // round the box: he lifts it side-on to us
  const PA2 = path([[3.12, -1.74], [4.3, -2.75], [5.8, -3.45], [7.25, -3.4]]), L2 = PA2.getLength();
  const V1 = 1.0, V2 = 0.95, STRIDE = 1.3;
  const t1 = 1.0, t1e = t1 + L1 / V1 + 0.7;            // arrives at the box
  const tLift = t1e + 1.15, tLook = tLift + 0.8, tCarry = tLook + 0.9;
  const t2 = tCarry + 0.45, t2e = t2 + L2 / V2 + 0.7;  // arrives at the wagon
  const tPlace = t2e + 0.45, tRel = tPlace + 1.0, tNod = tRel + 0.15;
  const END = tNod + 1.6;
  const beatTimes = [0.5, tLift - 0.3, t2e - 0.8];
  const wagonC = village.anchors.wagon.clone();
  const wagonTop = host.groundAt(wagonC.x, wagonC.z, 1.4);
  const PLACE = V(wagonC.x - 0.12, wagonTop + gH * 0.5 + 0.01, wagonC.z + 0.05);
  const DROP = village.dropTop.clone().add(V(0, gH * 0.5, 0));
  const yawBox = -Math.PI / 2, yawWagon = yawOf(PLACE.clone().sub(P2).setY(0));
  const yawIdleA = 0.5, yawB0 = yawOf(P2.clone().sub(BPOS).setY(0));

  function charState(t) {
    // Marine A
    let a;
    if (t < t1e) {
      const tr = travel(t, t1, L1, V1), u = clamp(tr.s / L1);
      const tg = PA1.getTangentAt(Math.min(u, 0.999));
      const yawWalk = yawOf(tg);
      a = { p: PA1.getPointAt(u), yaw: angLerp(yawIdleA, yawWalk, ramp(t, t1 - 0.3, t1 + 0.4)), speed: tr.v, phase: tr.s / STRIDE, carry: 0 };
      if (u > 0.85) a.yaw = angLerp(a.yaw, yawBox, ramp(u, 0.85, 1));
    } else if (t < t2) {
      const leaving = ramp(t, tCarry + 0.05, t2);
      a = { p: P1.clone(), yaw: angLerp(yawBox, yawOf(PA2.getTangentAt(0.02)), leaving), speed: 0, phase: L1 / STRIDE, carry: ramp(t, tCarry - 0.1, tCarry + 0.4) };
    } else if (t < t2e) {
      const tr = travel(t, t2, L2, V2), u = clamp(tr.s / L2);
      a = { p: PA2.getPointAt(u), yaw: yawOf(PA2.getTangentAt(Math.min(u, 0.999))), speed: tr.v, phase: (L1 + tr.s) / STRIDE, carry: 1 };
      if (u > 0.8) a.yaw = angLerp(a.yaw, yawWagon, ramp(u, 0.8, 1));
    } else {
      a = { p: P2.clone(), yaw: yawWagon, speed: 0, phase: (L1 + L2) / STRIDE, carry: 1 - ramp(t, tPlace - 0.2, tPlace + 0.3) };
    }
    // Marine B waits by the wagon, turns to watch A arrive
    const b = { p: BPOS.clone(), yaw: angLerp(yawB0 + 0.7, yawB0, ramp(t, t2 + 1.0, t2 + 2.2)), speed: 0, phase: 0, carry: 0 };
    return { a, b };
  }

  let t = -1, running = false, ended = false, beatShown = -1;
  function evaluate(T0) {
    const tc = Math.floor(T0 * 12) / 12;                    // puppets move on twos
    const st = charState(tc);
    poseMarine(A, st.a, tc); poseMarine(Bm, st.b, tc + 0.7);
    const fa = axes(A), fb = axes(Bm);
    // lean over the box / the wagon
    const lean = 0.42 * (ramp(tc, t1e + 0.1, t1e + 0.6) - ramp(tc, tLift - 0.1, tLift + 0.5)) + 0.3 * (ramp(tc, t2e + 0.1, tPlace) - ramp(tc, tRel - 0.1, tRel + 0.4));
    if (lean > 0.001) rotateBoneWorld(A.bones.spine, fa.left, lean);
    // the present
    const offer = A.obj.position.clone().addScaledVector(fa.fwd, 0.32).setY(GROUND + 1.0);
    const cA = carryXform(A);
    const yawQ = (y) => new T.Quaternion().setFromAxisAngle(V(0, 1, 0), y);
    let gp, gq;
    if (tc < tCarry) {
      const appear = ramp(tc, 0.2, 0.75);                    // it has just been set down: a small settle
      gp = DROP.clone().add(V(0, 0.12 * (1 - appear), 0)).lerp(offer, ramp(tc, tLift, tLift + 0.75));
      gq = yawQ(0.4).slerp(yawQ(st.a.yaw), ramp(tc, tLift, tLift + 0.75));
      gift.scale.setScalar(clamp(appear * 1.4, 0.001, 1));
    } else if (tc < tPlace - 0.2) {
      const k = ramp(tc, tCarry, tCarry + 0.45);
      gp = offer.clone().lerp(cA.p, k); gq = yawQ(st.a.yaw).slerp(cA.q, k); gift.scale.setScalar(1);
    } else {
      const k = ramp(tc, tPlace - 0.2, tPlace + 0.55);
      gp = cA.p.clone().lerp(PLACE, k); gq = cA.q.clone().slerp(yawQ(0.6), k); gift.scale.setScalar(1);
    }
    gift.position.copy(gp); gift.quaternion.copy(gq); gift.updateMatrixWorld(true);
    // hands on the sides of the present while lifting, looking and placing
    const gl = V(1, 0, 0).applyQuaternion(gq);
    const side = (sgn) => gp.clone().addScaledVector(gl, 0.135 * sgn).addScaledVector(fa.fwd, -0.045).add(V(0, 0.035, 0));
    const pole = (s) => A.bones['upper_arm' + s].getWorldPosition(V()).add(V(0, -1, 0)).addScaledVector(fa.left, s === 'L' ? 0.6 : -0.6).addScaledVector(fa.fwd, -0.3);
    const sA = Math.sign(fa.left.dot(gl)) || 1;
    const w = ramp(tc, t1e + 0.35, t1e + 0.9) * (1 - ramp(tc, tCarry, tCarry + 0.4)) + ramp(tc, tPlace - 0.3, tPlace + 0.2) * (1 - ramp(tc, tRel, tRel + 0.35));
    ikArm(A, 'L', side(sA), pole('L'), w); ikArm(A, 'R', side(-sA), pole('R'), w);
    // he looks at the toy for a moment, then up toward the wagon
    const look = ramp(tc, tLift + 0.4, tLook) * (1 - ramp(tc, tCarry, tCarry + 0.5));
    if (look > 0) rotateBoneWorld(A.bones.head, fa.left, 0.32 * look);
    // B: a small nod of thanks once the toy is in the wagon
    const nod = ramp(tc, tNod, tNod + 0.3) * (1 - ramp(tc, tNod + 0.55, tNod + 0.9));
    if (nod > 0) rotateBoneWorld(Bm.bones.head, fb.left, 0.22 * nod);
  }

  // idle life before the story starts: A glances around, B waits
  function idle(T0) {
    const tc = Math.floor(T0 * 12) / 12;
    poseMarine(A, { p: START, yaw: yawIdleA + 0.25 * Math.sin(tc * 0.4), speed: 0, phase: 0, carry: 0 }, tc);
    poseMarine(Bm, { p: BPOS, yaw: yawB0 + 0.7, speed: 0, phase: 0, carry: 0 }, tc + 0.7);
    gift.position.copy(DROP); gift.quaternion.setFromAxisAngle(V(0, 1, 0), 0.4); gift.scale.setScalar(1);
  }

  let seeking = false;
  host.onUpdate((dt) => {
    if (seeking) return;
    if (!running) { if (!ended) idle(host.time); return; }
    t = Math.min(END, t + dt);
    evaluate(t);
    for (let i = beatShown + 1; i < beatTimes.length; i++) if (t >= beatTimes[i]) { beatShown = i; onBeat && onBeat(i, STORY_COPY[i].text); }
    if (i_at(tNod)) village.celebrate(1);
    if (t >= END) { running = false; ended = true; host.tweenTo(END_SHOT, 1.4); onEnd && onEnd('complete'); }
  });
  let lastT = -1;
  function i_at(x) { const hit = lastT < x && t >= x; lastT = t; return hit; }

  // camera: one calm street-level shot that drifts to keep both Marines framed
  const SHOT0 = { pos: B(0.6, -10.6, 2.5), look: B(3.0, -2.2, 0.9), fov: 55 };
  const SHOT1 = { pos: B(3.4, -10.9, 2.5), look: B(5.6, -2.8, 0.9), fov: 55 };
  const END_SHOT = { pos: B(9.2, -9.6, 2.4), look: B(10.6, -2.4, 1.0), fov: 52 };   // wagon + Marines left of the card
  host.onUpdate(() => {
    if (!running || host.moving) return;
    const k = smooth((t - (t2 - 0.5)) / (t2e - t2 + 0.5));
    host.cur.pos.copy(SHOT0.pos).lerp(SHOT1.pos, k); host.cur.look.copy(SHOT0.look).lerp(SHOT1.look, k);
  });

  const headPos = () => A.bones.head.getWorldPosition(V()).add(V(0, 0.55, 0));
  return {
    duration: END,
    get running() { return running; }, get ended() { return ended; }, get time() { return t; },
    headPos, marine: A.obj,
    async start({ reducedMotion } = {}) {
      village.showPins(false); host.explore(null);
      t = 0; lastT = -1; beatShown = -1; ended = false; running = true;
      await host.tweenTo(SHOT0, reducedMotion ? 0 : 1.2);
    },
    skip() { if (!running && ended) return; t = END - 0.001; lastT = 0; evaluate(t); },
    stop() { running = false; seeking = false; },
    // stills / tests: pose everything at story time x without running
    seek(x) { seeking = true; running = false; t = x; evaluate(x); const k = smooth((x - (t2 - 0.5)) / (t2e - t2 + 0.5)); return { pos: SHOT0.pos.clone().lerp(SHOT1.pos, k), look: SHOT0.look.clone().lerp(SHOT1.look, k), fov: 55 }; },
    beats: () => ({ lift: tLift, look: tLook, place: tPlace, end: END }),
    reset() { running = false; ended = false; seeking = false; t = -1; idle(host.time); },
  };
}
