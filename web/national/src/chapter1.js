// Chapter 1 · It Starts With You (Maple Hollow, about 15 seconds).
// A parent and child walk up the sidewalk to the town's toy drop-off; a volunteer by the hall door waves them over;
// a Marine carries a carton of toys from the wagon into the hall; neighbours pass on the far side of the street.
// At the box the story waits (briefly, never more than a few seconds) for the visitor to tap the toy; the child sets
// the little red truck in, and the box glows. The camera stays low, among the townspeople, then rises to the street.
//
// Everything here is a pure function of story time t (plus wall-clock w for breathing and the passers-by), so pause,
// skip, replay and stills are exact. All positions are Maple Hollow's own units (three.js space of maple.glb).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB, S } from './community.js';
import { clay as claySurface, LOOK } from './clay.js';

// DRAFT copy, for the organisation to review. It describes this fictional family only: no statistics and no claims
// about how toys are collected or where they go.
export const CH1 = {
  title: 'It Starts With You',
  lines: [
    { at: 0.3, text: 'It starts with you.' },
    { at: 3.9, text: 'A family brings a new, unwrapped toy to the drop-off in their town.' },
    { at: 'land', text: 'One small gift…' },
    { at: 'd', text: '…joins many more from neighbors across town.' },
  ],
  prompt: 'Give the toy',
  next: 'Next: A Community Comes Together (coming soon)',
  text: [
    'Chapter 1: It Starts With You.',
    'Evening in Maple Hollow, a small snowy town. A parent and child walk along the sidewalk toward the community hall. The child carries a little red toy truck, new and unwrapped.',
    'A volunteer by the hall door waves hello. Nearby, a Marine carries a carton of toys from a wagon into the hall.',
    'At the toy drop-off box, the child reaches up and sets the truck inside. The box glows softly.',
    'One small gift joins many more from neighbors across town.',
  ],
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const angLerp = (a, b, k) => { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; };
const yawOf = (d) => Math.atan2(d.x, d.z);
const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), false, 'centripetal');

// trapezoid speed profile: start at t0, cover L at speed v, easing in and out over e seconds
function travel(t, t0, L, v, e = 0.7) {
  const Tt = L / v + e, a = v / e, u = t - t0;
  if (u <= 0) return { s: 0, v: 0 };
  if (u >= Tt) return { s: L, v: 0 };
  if (u < e) return { s: 0.5 * a * u * u, v: a * u };
  if (u > Tt - e) { const r = Tt - u; return { s: L - 0.5 * a * r * r, v: a * r }; }
  return { s: 0.5 * a * e * e + v * (u - e), v };
}

export async function createChapter1(town, { assets = './assets/', b64 = null } = {}) {
  const root = town.root;
  const load = (n) => loadGLB(assets + n, b64 && b64[n]);
  const [gm, gp, gc, gv, gprops] = await Promise.all(['marine.glb', 'ch1_parent.glb', 'ch1_child.glb', 'ch1_volunteer.glb', 'ch1_props.glb'].map(load));
  const group = new THREE.Group(); root.add(group);

  // ---------------------------------------------------------------- the cast
  function makeChar(g, { scale = 1, colors = [] } = {}) {
    const obj = skClone(g.scene);
    obj.scale.setScalar(scale);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const many = Array.isArray(o.material), out = (many ? o.material : [o.material]).map((m) => {
        const c = m.clone();
        for (const [re, col] of colors) if (re.test(m.name)) c.color.set(col);
        const felt = (m.userData && m.userData.kind === 'felt') || /Coat|Trouser/.test(m.name);
        claySurface(c, felt ? 'fabric' : 'clay', true, S * scale);
        return c;
      });
      o.material = many ? out : out[0];
    });
    group.add(obj);
    const mixer = new THREE.AnimationMixer(obj), acts = {};
    for (const clip of g.animations) { const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); acts[clip.name] = a; }
    const bones = {}; obj.traverse((o) => { if (o.isBone) bones[o.name.replace(/\./g, '')] = o; });
    return { obj, mixer, acts, bones, scale, stride: 1.3 * scale };
  }
  const marine = makeChar(gm);
  const parent = makeChar(gp);
  const child = makeChar(gc, { scale: 0.64 });
  const volunteer = makeChar(gv);
  // neighbours across the street (same sculpts, their own coats)
  const passer = makeChar(gp, { colors: [[/PCoat/, 0x6b3d6e], [/PHat/, 0x3e8a8c], [/PScarf/, 0xf0e2c4], [/PMitt/, 0x3e8a8c]] });
  const passer2 = makeChar(gv, { colors: [[/PCoat|PVest/, 0xd9a93f], [/PHat/, 0x2d5fae], [/PSkin/, 0xc98a62], [/PHair/, 0x2a1a12]] });
  const passerKid = makeChar(gc, { scale: 0.6, colors: [[/PCoat/, 0xa8322f], [/PHat/, 0x3f6f57], [/PSkin/, 0xc98a62]] });

  // ---------------------------------------------------------------- props
  const props = gprops.scene;
  props.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (LOOK.felt) LOOK.townScale = S; claySurface(o.material, 'clay', false); if (LOOK.felt) LOOK.townScale = null;
  });
  const take = (name) => { const o = props.getObjectByName(name); o.removeFromParent(); group.add(o); return o; };
  const truck = take('Truck'), carton = take('Carton'), wagon = take('Wagon');
  const given = carton.clone(true); group.add(given);            // toys already given, beside the box
  truck.scale.setScalar(1.0); carton.scale.setScalar(0.62);
  const place = (o, x, z, yaw, s = 1) => { o.position.set(x, town.groundAt(x, z), z); o.rotation.set(0, yaw, 0); o.scale.setScalar(s); };
  place(wagon, -2.05, 0.78, 0.0, 1.05);
  place(given, 3.4, 0.95, 0.4, 0.9);

  // the box's glow when the toy goes in, and a few rising sparks
  const BOX = V(...town.meta.box), SLOT = V(BOX.x, 0.84, BOX.z + 0.02);
  const glow = new THREE.PointLight(0xffc27a, 0, 3.2 * S, 2);   // light ranges/intensities are in world units (× S, × S²) glow.position.copy(SLOT).add(V(0, 0.25, 0.1)); group.add(glow);
  const slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.36), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb85a).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  slotGlow.rotation.x = -Math.PI / 2; slotGlow.position.set(BOX.x, 0.826, BOX.z - 0.02); group.add(slotGlow);
  const NSP = 26, spark = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(3), transparent: true, depthWrite: false }), NSP);
  spark.frustumCulled = false; group.add(spark);
  const seeds = Array.from({ length: NSP }, (_, i) => [Math.sin(i * 12.9898) * 43758.5453 % 1, Math.sin(i * 78.233) * 12543.123 % 1, (i * 0.618) % 1]);

  // ---------------------------------------------------------------- the script (story time, seconds)
  const C_PATH = curve([[-4.6, 2.35], [-2.2, 2.45], [0.4, 2.42], [2.15, 2.2], [3.1, 1.72]]), LC = C_PATH.getLength();
  const P_PATH = curve([[-5.4, 2.72], [-2.6, 2.78], [0.6, 2.78], [2.2, 2.85], [3.3, 2.8]]), LP = P_PATH.getLength();
  const M_PATH = curve([[-2.6, 1.85], [-1.3, 1.6], [-0.45, 0.98], [0.0, 0.32]]), LM = M_PATH.getLength();
  const VOL = V(1.35, 0, 0.85);
  const tW0 = 0.4, TW = 6.4, tArrive = tW0 + TW;            // the family reaches the box
  const vC = LC / (TW - 0.7), vP = LP / (TW - 0.7);
  const tM0 = 0.2, vM = 0.95, tCut = 3.8;                    // the Marine reaches the hall door as the shot cuts
  const B = { hold: tArrive + 0.5 };                         // the story waits here for the visitor (a few seconds at most)
  B.give = B.hold + 0.05; B.rel = B.give + 0.85; B.land = B.rel + 0.55; B.d = B.land + 1.0; B.end = B.d + 4.6;
  const YAW_CHILD = yawOf(V(-1, 0, -0.3)), YAW_PARENT = yawOf(V(-0.55, 0, -1.0));
  const YAW_VOL0 = yawOf(V(-1, 0, 0.75)), YAW_VOL1 = yawOf(V(3.1 - VOL.x, 0, 1.72 - VOL.z));

  function walker(path, L, v, t0, t, endYaw, stride) {
    const tr = travel(t, t0, L, v), u = clamp(tr.s / L);
    const p = path.getPointAt(u);
    let yaw = yawOf(path.getTangentAt(Math.min(u, 0.999)));
    if (u > 0.82) yaw = angLerp(yaw, endYaw, ramp(u, 0.82, 1));
    return { p, yaw, speed: tr.v, phase: tr.s / stride, done: u >= 1 };
  }

  function pose(M, p, yaw, W, w, extra = {}) {
    M.obj.position.set(p.x, town.groundAt(p.x, p.z), p.z); M.obj.rotation.set(0, yaw, 0);
    for (const [k, a] of Object.entries(M.acts)) {
      const wt = W[k] || 0; a.setEffectiveWeight(wt);
      const d = a.getClip().duration;
      a.time = k.startsWith('Walk') ? (((extra.phase || 0) % 1 + 1) % 1) * d : k === 'Give' ? clamp(extra.give || 0, 0, d - 1e-3) : (w + (extra.off || 0)) % d;
    }
    M.mixer.update(0); M.obj.updateMatrixWorld(true);
  }
  const walkW = (s) => smooth(s.speed / 0.45);
  const _q = new THREE.Quaternion();
  const nod = (M, k) => { if (k <= 0.001) return; const ax = V(1, 0, 0).applyQuaternion(M.obj.quaternion); M.bones.head.getWorldQuaternion(_q);
    const qw = new THREE.Quaternion().setFromAxisAngle(ax, 0.3 * k).multiply(_q); M.bones.head.parent.getWorldQuaternion(_q); M.bones.head.quaternion.copy(_q.invert().multiply(qw)); M.bones.head.updateMatrixWorld(true); };
  // a point in a character's model space (its own units) → Maple Hollow units
  const fromModel = (M, boneName, ofs) => { const w = M.bones[boneName].getWorldPosition(V()); const l = M.obj.worldToLocal(w).add(ofs); return root.worldToLocal(M.obj.localToWorld(l)); };

  function evaluate(t, w) {
    const tc = Math.floor(t * 12) / 12, wc = Math.floor(w * 12) / 12;     // puppets move on twos
    // --- the Marine: carton from the wagon to the hall door (then he is inside)
    const m = walker(M_PATH, LM, vM, tM0, tc, Math.PI, 1.3);
    marine.obj.visible = tc < tCut;
    pose(marine, m.p, m.yaw, { WalkCarry: walkW(m), IdleCarry: 1 - walkW(m) }, wc, { phase: m.phase });
    if (marine.obj.visible) {
      const yawQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), m.yaw + 0.2);
      carton.position.copy(fromModel(marine, 'handL', V(-0.07, 0.13, -0.03))).add(V(0, -0.08, 0)); carton.quaternion.copy(yawQ);
    }
    carton.visible = marine.obj.visible;
    // --- the family
    const c = walker(C_PATH, LC, vC, tW0, tc, YAW_CHILD, child.stride);
    const p = walker(P_PATH, LP, vP, tW0 + 0.15, tc, YAW_PARENT, parent.stride);
    const g = tc - B.give, giving = clamp(g / 0.25) * (1 - ramp(g, 1.75, 2.0));
    const carry = 1 - ramp(tc, B.rel - 0.05, B.rel + 0.25);
    const cw = walkW(c);
    pose(child, c.p, c.yaw, { WalkCarry: cw * carry, Walk: cw * (1 - carry), IdleCarry: (1 - cw) * carry * (1 - giving), Idle: (1 - cw) * (1 - carry) * (1 - giving), Give: giving }, wc, { phase: c.phase, give: g, off: 0.6 });
    const pw = walkW(p), look = ramp(tc, tArrive - 0.4, tArrive + 0.6);
    pose(parent, p.p, p.yaw, { Walk: pw, Idle: (1 - pw) * (1 - look), Look: (1 - pw) * look }, wc, { phase: p.phase, off: 1.3 });
    // --- the volunteer: waves the family over, turns to watch, waves again once the toy is in
    const wave1 = ramp(tc, 1.8, 2.3) * (1 - ramp(tc, 4.6, 5.1)), wave2 = ramp(tc, B.land + 0.5, B.land + 1.0);
    const vy = angLerp(YAW_VOL0, YAW_VOL1, ramp(tc, 4.8, 6.0));
    pose(volunteer, VOL, vy, { Wave: Math.max(wave1, wave2), Idle: 1 - Math.max(wave1, wave2) }, wc, { off: 0.3 });
    nod(volunteer, ramp(tc, B.land + 0.1, B.land + 0.35) * (1 - ramp(tc, B.land + 0.5, B.land + 0.8)));
    // --- the red truck: carried, held out, set into the box
    const hold = fromModel(child, 'handL', V(-0.06, 0.12, -0.03));
    const hands = fromModel(child, 'handL', V(0, 0, 0)).add(fromModel(child, 'handR', V(0, 0, 0))).multiplyScalar(0.5).add(V(0, 0.04, 0));
    const held = hold.clone().lerp(hands, ramp(tc, B.give, B.give + 0.5));
    const k = clamp((tc - B.rel) / (B.land - B.rel));
    let tp;
    if (tc < B.rel) tp = held;
    else if (tc < B.land) { tp = held.clone().lerp(SLOT, smooth(k)); tp.y += Math.sin(Math.PI * k) * 0.16; }
    else tp = SLOT.clone().add(V(0, -0.35 * ramp(tc, B.land, B.land + 0.35), 0));
    truck.position.copy(tp); truck.rotation.set(0, lerp(c.yaw + Math.PI / 2, Math.PI / 2 + 0.3, ramp(tc, B.rel, B.land)), 0);
    truck.visible = tc < B.land + 0.35;
    // --- the glow and the sparks
    const gk = ramp(tc, B.land - 0.05, B.land + 0.35) * (1 - ramp(tc, B.land + 1.2, B.land + 3.6));
    glow.intensity = 9 * S * S * gk; slotGlow.material.opacity = gk; slotGlow.visible = gk > 0.001;
    const sp = clamp((tc - B.land) / 2.2), mtx = new THREE.Matrix4();
    for (let i = 0; i < NSP; i++) {
      const [a, b, e] = seeds[i].map(Math.abs), s = sp > 0 && sp < 1 ? (1 - sp) * (0.6 + 0.6 * e) : 0;
      const r = 0.1 + 0.25 * sp * a, ang = i * 2.4 + sp * 2;
      mtx.compose(V(SLOT.x + Math.cos(ang) * r, SLOT.y + 0.05 + sp * (0.5 + 0.7 * b), SLOT.z + Math.sin(ang) * r * 0.6), new THREE.Quaternion(), V(s, s, s));
      spark.setMatrixAt(i, mtx);
    }
    spark.instanceMatrix.needsUpdate = true; spark.visible = sp > 0 && sp < 1;
    // --- passers-by on the far sidewalk (wall clock, so they keep walking while the story waits)
    const lane = (x0, x1, v, w0) => { const L = Math.abs(x1 - x0), s = ((w * v + w0) % L + L) % L; return x0 + Math.sign(x1 - x0) * s; };
    const x1 = lane(-11, 12, 0.85, 3), x2 = lane(12.5, -11, 0.8, 9);
    pose(passer, V(x1, 0, 9.05), Math.PI / 2, { Walk: 1 }, wc, { phase: (w * 0.85) / 1.3 });
    pose(passer2, V(x2, 0, 8.95), -Math.PI / 2, { Walk: 1 }, wc, { phase: (w * 0.8) / 1.3 + 0.3 });
    pose(passerKid, V(x2 + 0.15, 0, 9.55), -Math.PI / 2, { Walk: 1 }, wc, { phase: (w * 0.8) / (1.3 * 0.6) });
  }

  // ---------------------------------------------------------------- camera: low among the townspeople, then rising to the street
  const portrait = () => innerWidth < innerHeight;
  function shot(t, reduced = false) {
    const P = portrait();
    if (t < tCut) {                                           // A · wide and low from the street: everyone in the scene
      const u = reduced ? 0.5 : smooth(t / tCut);
      return { pos: V(lerp(3.1, 2.4, u), lerp(1.3, 1.2, u), lerp(5.7, 5.0, u) + (P ? 1.4 : 0)), look: V(lerp(-2.6, -1.9, u), 0.9, lerp(2.0, 1.8, u)) };
    }
    if (t < tArrive - 0.2) {                                  // B · following the family up the sidewalk
      const c = C_PATH.getPointAt(clamp(travel(t, tW0, LC, vC).s / LC));
      return { pos: V(5.0, 1.45, 5.9 + (P ? 1.2 : 0)), look: V(lerp(c.x, BOX.x, 0.35), 0.75, lerp(c.z, BOX.z, 0.35)) };
    }
    if (t < B.d) {                                            // C · close on the box, the child's face in three-quarter view
      const u = reduced ? 0 : smooth((t - tArrive) / (B.d - tArrive));
      return { pos: V(lerp(0.3, 0.55, u), lerp(1.2, 1.12, u), lerp(4.15, 3.85, u) + (P ? 0.9 : 0)), look: V(2.85, 0.8, 1.7) };
    }
    const u = reduced ? 1 : smooth((t - B.d) / (B.end - B.d - 0.4));   // D · rise up to the street
    // (stays in front of the church across the street, z < 10.6; on phones it rises higher instead of further)
    return { pos: V(lerp(0.55, 3.2, u), lerp(1.12, P ? 7.2 : 4.6, u), lerp(3.85 + (P ? 0.9 : 0), 10.2, u)), look: V(lerp(2.85, 1.6, u), lerp(0.8, 1.2, u), lerp(1.7, 0.9, u)) };
  }
  const toWorld = (v) => root.localToWorld(v.clone());

  function caption(t) {
    let txt = '';
    for (const l of CH1.lines) { const at = typeof l.at === 'number' ? l.at : B[l.at]; if (t >= at) txt = l.text; }
    return txt;
  }

  return {
    group, beats: B, duration: B.end, evaluate, caption,
    shotWorld(t, reduced) { const s = shot(t, reduced); return { pos: toWorld(s.pos), look: toWorld(s.look) }; },
    toyWorld() { return truck.getWorldPosition(V()); },
  };
}
