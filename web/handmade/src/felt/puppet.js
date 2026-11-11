// Experiment B — the Marine as a handmade cloth doll: stuffed felt limbs with stitched seams, button joints,
// button eyes, an embroidered smile, appliqué cheeks, yarn hair, a felt cap. Same skeleton and walk as before.
import * as THREE from 'three';
import { V, M, circle, ellipse, rect, slab } from '../kit.js';
import { rigPuppet } from '../puppet.js';
import { makeFeltKit, lumpGeo, pillowGeo } from './kit.js';
import { makeFuzz } from './materials.js';

const NAVY = 0x1e2b4c, TROUSER = 0x31508e, RED = 0xb3262c, WHITE = 0xf3eee4, SKIN = 0xdba07a, BLACK = 0x1c1a20, GOLD = 0xd9a441, HAIR = 0x4a2c1c, CHEEK = 0xe58a78, THREAD = 0xf3e9d6;
const up = V(0, 1, 0);

/** a stuffed limb: a lathe profile from a to b, rounded at both ends, slightly lumpy */
function limbGeo(a, b, rA, rB, seg = 14) {
  const len = a.distanceTo(b), pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12, end = Math.sin(t * Math.PI) ** 0.35, r = (rA + (rB - rA) * t) * Math.max(0.05, end); pts.push(new THREE.Vector2(r, t * len)); }
  const g = new THREE.LatheGeometry(pts, seg); g.deleteAttribute('uv');
  const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize()); g.applyQuaternion(q); g.translate(a.x, a.y, a.z);
  return g;
}
/** frame on a limb's surface: origin at point p, facing outward n (for stitches and appliqué) */
const faceFrame = (p, n, upHint = up) => new THREE.Matrix4().lookAt(V(0, 0, 0), n.clone().negate(), upHint.clone().add(V(0.0013, 0, 0.0011))).setPosition(p);

export function feltPuppet(gltf, mats) {
  const kits = {};
  const rig = rigPuppet(gltf, ({ part, joint }) => {
    const K = (bone) => kits[bone] || (kits[bone] = makeFeltKit(Object.keys(kits).length * 7 + 3));
    const add = (bone, geo, col, fuzz = 1) => K(bone).solid(geo, null, col, { fuzz });
    const seam = (bone, a, b, out, r, col = THREAD) => {     // a running stitch along the side seam of a limb
      const k = K(bone), n = 9; for (let i = 0; i < n; i++) { const t0 = (i + 0.15) / n, t1 = (i + 0.6) / n; const p0 = a.clone().lerp(b, t0).addScaledVector(out, r), p1 = a.clone().lerp(b, t1).addScaledVector(out, r); k.S.add(p0, p1, col, 0.006); }
    };
    const button = (bone, p, n, s, col) => K(bone).button(faceFrame(p, n), 0, 0, 0, s, col, THREAD);

    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1, out = V(sx, 0, 0);
      const hip = joint('thigh.' + s), knee = joint('shin.' + s), ankle = joint('foot.' + s);
      add('thigh.' + s, limbGeo(hip.clone().add(V(0, 0.04, 0)), knee.clone().add(V(0, -0.03, 0)), 0.088, 0.072), TROUSER);
      add('shin.' + s, limbGeo(knee.clone().add(V(0, 0.04, 0)), ankle.clone().add(V(0, -0.0, 0)), 0.072, 0.064), TROUSER);
      // the red trouser stripe: a narrow felt strip sewn down the outer seam
      for (const [bone, a, b, r] of [['thigh.' + s, hip.clone().add(V(0, -0.04, 0)), knee.clone().add(V(0, 0.02, 0)), 0.078], ['shin.' + s, knee.clone().add(V(0, -0.02, 0)), ankle.clone().add(V(0, 0.06, 0)), 0.066]]) {
        const g = new THREE.BoxGeometry(0.022, a.distanceTo(b), 0.012); g.translate(sx * r, (a.y + b.y) / 2, a.z); add(bone, g, RED, 0.6);
        seam(bone, a, b, out, r + 0.008, 0x7a161a);
      }
      const shoe = lumpGeo(0.062, 0.045, 0.115, { detail: 2, amp: 0.06, seed: 3 }); shoe.translate(ankle.x, 0.045, ankle.z + 0.05); add('foot.' + s, shoe, BLACK, 0.6);
      button('thigh.' + s, hip.clone().add(V(sx * 0.1, -0.05, 0)), out, 0.03, GOLD);
      // arms
      const sh = joint('upper_arm.' + s), el = joint('forearm.' + s), wr = joint('hand.' + s);
      add('upper_arm.' + s, limbGeo(sh.clone().add(V(0, 0.04, 0)), el.clone().add(V(0, -0.02, 0)), 0.064, 0.057), NAVY);
      add('forearm.' + s, limbGeo(el.clone().add(V(0, 0.03, 0)), wr.clone().add(V(0, 0.02, 0)), 0.057, 0.052), NAVY);
      const cuff = new THREE.TorusGeometry(0.05, 0.014, 8, 18); cuff.rotateX(Math.PI / 2); cuff.translate(wr.x, wr.y + 0.05, wr.z); add('forearm.' + s, cuff, RED, 0.6);
      seam('upper_arm.' + s, sh, el, V(0, 0, -1), 0.06); seam('forearm.' + s, el, wr, V(0, 0, -1), 0.054);
      const mitt = lumpGeo(0.042, 0.06, 0.035, { detail: 2, amp: 0.08, seed: 9 }); mitt.translate(wr.x, wr.y - 0.04, wr.z); add('hand.' + s, mitt, WHITE, 1);
      // appliqué chevrons on the sleeve, held with gold stitches
      for (let c = 0; c < 2; c++) {
        const p = V(sh.x + sx * 0.064, sh.y - 0.1 - c * 0.04, sh.z), F = faceFrame(p, out);
        const chev = slab([[-0.045, 0.02], [0, -0.012], [0.045, 0.02], [0.045, 0.002], [0, -0.03], [-0.045, 0.002]], null, 0.01); chev.applyMatrix4(F);
        K('upper_arm.' + s).B.felt.add(chev, null, RED, { extra: 0.4 });
        K('upper_arm.' + s).S.addLocal(F, [-0.035, 0.012, 0.012], [0.035, 0.012, 0.012], GOLD, 0.005);
      }
      button('upper_arm.' + s, sh.clone().add(V(sx * 0.066, 0.0, 0)), out, 0.03, GOLD);
    }
    // body: coat, belt with a button buckle, buttons down the front, red collar
    add('hips', limbGeo(V(0, 0.79, 0), V(0, 1.06, 0), 0.19, 0.18, 18).scale(1, 1, 0.72), NAVY);
    const belt = new THREE.CylinderGeometry(0.192, 0.192, 0.055, 24, 1, true); belt.scale(1, 1, 0.74); belt.translate(0, 0.93, 0); add('hips', belt, WHITE, 0.6);
    button('hips', V(0, 0.93, 0.146), V(0, 0, 1), 0.026, GOLD);
    add('spine', limbGeo(V(0, 0.98, 0), V(0, 1.2, 0), 0.18, 0.19, 18).scale(1, 1, 0.7), NAVY);
    add('chest', limbGeo(V(0, 1.12, 0), V(0, 1.4, 0), 0.19, 0.16, 18).scale(1, 1, 0.7), NAVY);
    const collar = new THREE.CylinderGeometry(0.078, 0.082, 0.06, 18); collar.translate(0, 1.39, 0); add('chest', collar, RED, 0.6);
    for (let i = 0; i < 4; i++) { const y = 1.03 + i * 0.08; button(y > 1.18 ? 'chest' : 'spine', V(0, y, 0.135 - (y > 1.2 ? (y - 1.2) * 0.12 : 0)), V(0, 0.05, 1).normalize(), 0.018, GOLD); }
    const k = K('chest'); for (let i = 0; i < 10; i++) { const y0 = 1.02 + i * 0.033; k.S.add(V(0.045, y0, 0.132), V(0.045, y0 + 0.02, 0.131), RED, 0.005); k.S.add(V(-0.045, y0, 0.132), V(-0.045, y0 + 0.02, 0.131), RED, 0.005); }
    // head: a stuffed ball with a seam, button eyes, an embroidered smile, cheeks, ears, yarn hair
    const hc = V(0, 1.55, 0.01);
    const head = lumpGeo(0.13, 0.135, 0.125, { detail: 3, amp: 0.035, seed: 21 }); head.translate(hc.x, hc.y, hc.z); add('head', head, SKIN, 0.8);
    const neck = limbGeo(V(0, 1.36, 0), V(0, 1.46, 0), 0.05, 0.05, 10); add('neck', neck, SKIN, 0.6);
    const hk = K('head');
    for (const e of [-1, 1]) {
      button('head', V(e * 0.046, 1.565, 0.125), V(e * 0.2, 0.05, 1).normalize(), 0.02, BLACK);
      const ch = slab(circle(0, 0, 0.024, 16), null, 0.006); ch.applyMatrix4(faceFrame(V(e * 0.078, 1.515, 0.108), V(e * 0.55, -0.1, 1).normalize())); hk.B.felt.add(ch, null, CHEEK, { extra: 0.3 });
      const ear = pillowGeo(ellipse(0, 0, 0.032, 0.042, 14), 0.012, { rings: 3 }); ear.applyMatrix4(faceFrame(V(e * 0.128, 1.55, 0.0), V(e, 0, 0))); hk.B.felt.add(ear, null, SKIN, { extra: 0.6 });
    }
    // smile: a curve of tiny backstitches in dark red floss
    let prev = null; for (let i = 0; i <= 8; i++) { const t = i / 8, a = (-0.5 + t) * 1.4, p = V(Math.sin(a) * 0.045, 1.495 - Math.cos(a) * 0.012 + 0.012, 0.124 - Math.abs(Math.sin(a)) * 0.012); if (prev) hk.S.add(prev, p, 0x7a1e22, 0.0055); prev = p; }
    const nose = new THREE.SphereGeometry(0.016, 10, 8); nose.translate(0, 1.53, 0.135); add('head', nose, 0xd18f6a, 0.4);
    for (let i = 0; i < 14; i++) {   // yarn hair: little loops round the back of the head, under the cap
      const a = Math.PI * 0.62 + (i / 13) * Math.PI * 0.76, loop = new THREE.TorusGeometry(0.022, 0.009, 6, 12);
      loop.rotateY(-a + Math.PI / 2); loop.translate(Math.cos(a) * 0.125 * -1, 1.6 - (i % 2) * 0.02, Math.sin(a) * 0.12 * -1); add('head', loop, HAIR, 1.4);
    }
    // the cap: a stuffed white crown, black band, a pillowy visor, gold button
    const crown = limbGeo(V(0, 1.64, -0.01), V(0, 1.74, -0.02), 0.15, 0.17, 20); crown.scale(1, 1, 1); add('head', crown, WHITE, 0.8);
    const band = new THREE.CylinderGeometry(0.135, 0.132, 0.05, 20); band.translate(0, 1.645, -0.005); add('head', band, BLACK, 0.6);
    const visor = pillowGeo([[-0.11, 0], [0.11, 0], [0.09, 0.07], [0, 0.095], [-0.09, 0.07]], 0.012, { rings: 3 }); visor.applyMatrix4(M([0, 1.625, 0.095], [Math.PI / 2 - 0.35, 0, 0])); hk.B.felt.add(visor, null, BLACK, { extra: 0.5 });
    button('head', V(0, 1.68, 0.14), V(0, 0.1, 1).normalize(), 0.022, GOLD);
    const ck = K('head'); for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; ck.S.add(V(Math.cos(a) * 0.155, 1.7, -0.015 + Math.sin(a) * 0.155), V(Math.cos(a + 0.15) * 0.155, 1.7, -0.015 + Math.sin(a + 0.15) * 0.155), 0xb8b0a0, 0.005); }

    for (const [bone, kk] of Object.entries(kits)) {
      const fm = kk.B.felt.mesh(mats.felt); if (fm) { part(bone, fm); const fz = makeFuzz(fm, mats.fuzz); fz.position.set(0, 0, 0); fz.quaternion.identity(); fz.scale.set(1, 1, 1); fm.add(fz); fz.castShadow = false; }
      const mm = kk.B.metal.mesh(mats.metal); if (mm) part(bone, mm);
      if (kk.S.items.length) part(bone, kk.S.build(mats.thread));
    }
  });
  return rig;
}
