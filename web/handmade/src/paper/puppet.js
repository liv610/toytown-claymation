// Experiment A — the Marine as an articulated papercraft puppet.
// Limbs and body are folded card prisms (flat facets, crisp creases), details are cut and glued on
// (piping, buttons, chevrons, face), and every joint is held by a brass split-pin fastener.
import * as THREE from 'three';
import { Batch, prim, V, M, slab, circle, ellipse, rect } from '../kit.js';
import { rigPuppet } from '../puppet.js';

const NAVY = 0x1c2847, TROUSER = 0x2f4a8c, RED = 0xb0242a, WHITE = 0xf4efe4, SKIN = 0xd99a72, BLACK = 0x17161b, GOLD = 0xd9a441, HAIR = 0x3b2418, CHEEK = 0xe88f78;
const up = V(0, 1, 0);

/** a folded prism (n facets) from a to b, radii rA → rB, optionally elliptical (sx, sz), one facet turned to face +z */
function prismGeo(a, b, rA, rB, sides = 6, sx = 1, sz = 1, caps = true) {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(rB, rA, len, sides, 1, !caps);
  g.rotateY(Math.PI / sides); g.scale(sx, 1, sz);
  const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
  g.applyQuaternion(q); const mid = a.clone().add(b).multiplyScalar(0.5); g.translate(mid.x, mid.y, mid.z);
  return prim(g, false);
}
/** a thin glued-on strip from a to b, pushed out along `out` by r */
function stripGeo(a, b, out, r, w, t = 0.006) {
  const len = a.distanceTo(b), g = new THREE.BoxGeometry(w, len, t);
  const dir = b.clone().sub(a).normalize(), o = out.clone().normalize();
  const x = new THREE.Vector3().crossVectors(dir, o).normalize(), z = new THREE.Vector3().crossVectors(x, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(x, dir, z).setPosition(a.clone().add(b).multiplyScalar(0.5).addScaledVector(o, r + t / 2));
  g.applyMatrix4(m); return prim(g, false);
}
/** a flat cut piece facing direction n at point p */
function disc(p, n, r, t = 0.008, seg = 12, shape = null) {
  const g = slab(shape || circle(0, 0, r, seg), null, t, { center: true });
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), n.clone().negate(), up.clone().add(V(0.001, 0, 0))).setPosition(p);
  g.applyMatrix4(m); return g;
}

export function paperPuppet(gltf, { card, foil }) {
  const rig = rigPuppet(gltf, ({ part, joint }) => {
    const batches = {};
    const B = (bone, kind = 'card') => { const k = bone + ':' + kind; return batches[k] || (batches[k] = { bone, kind, b: new Batch(k, Object.keys(batches).length + 3) }); };
    const add = (bone, geo, col, kind = 'card', edge = 0) => B(bone, kind).b.add(geo, null, col, { vary: 0.03, edge });
    const pin = (bone, p, n) => { add(bone, disc(p, n, 0.022, 0.01, 10), GOLD, 'foil'); add(bone, disc(p.clone().addScaledVector(n, 0.008), n, 0.012, 0.008, 8), GOLD, 'foil'); };

    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1, out = V(sx, 0, 0);
      const hip = joint('thigh.' + s), knee = joint('shin.' + s), ankle = joint('foot.' + s);
      // trousers: folded hexagonal tubes with the red "blood stripe" glued down the outer seam
      add('thigh.' + s, prismGeo(hip.clone().add(V(0, 0.02, 0)), knee.clone().add(V(0, -0.02, 0)), 0.085, 0.07, 6, 1, 0.95), TROUSER);
      add('thigh.' + s, stripGeo(hip.clone().add(V(0, -0.02, 0)), knee, out, 0.07, 0.02), RED);
      add('shin.' + s, prismGeo(knee.clone().add(V(0, 0.03, 0)), ankle.clone().add(V(0, 0.02, 0)), 0.068, 0.062, 6), TROUSER);
      add('shin.' + s, stripGeo(knee, ankle.clone().add(V(0, 0.04, 0)), out, 0.062, 0.02), RED);
      // shoe: a folded wedge of glossy black card
      const heel = V(ankle.x, 0.0, ankle.z - 0.05), toe = V(ankle.x, 0.0, ankle.z + 0.17);
      const shoe = new THREE.BoxGeometry(0.11, 0.075, toe.z - heel.z); shoe.translate(ankle.x, 0.04, (heel.z + toe.z) / 2);
      const pos = shoe.attributes.position; for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.05 && pos.getZ(i) > ankle.z + 0.05) pos.setY(i, 0.055);
      add('foot.' + s, prim(shoe, false), BLACK, 'foil');
      // split pins at hip and knee (on the outside of the leg)
      pin('thigh.' + s, hip.clone().add(V(sx * 0.088, -0.06, 0)), out);
      pin('shin.' + s, knee.clone().add(V(sx * 0.072, 0, 0)), out);

      // arms: tapered navy tubes; red-and-gold chevrons on the upper sleeve; white mitten gloves
      const sh = joint('upper_arm.' + s), el = joint('forearm.' + s), wr = joint('hand.' + s);
      add('upper_arm.' + s, prismGeo(sh.clone().add(V(0, 0.03, 0)), el, 0.062, 0.055, 6), NAVY);
      add('forearm.' + s, prismGeo(el.clone().add(V(0, 0.02, 0)), wr.clone().add(V(0, 0.02, 0)), 0.055, 0.05, 6), NAVY);
      add('forearm.' + s, prismGeo(wr.clone().add(V(0, 0.07, 0)), wr.clone().add(V(0, 0.035, 0)), 0.056, 0.056, 6), RED);
      for (let c = 0; c < 2; c++) {
        const y = sh.y - 0.1 - c * 0.035, p = V(sh.x + sx * 0.062, y, sh.z);
        const chev = [[-0.045, 0.02], [0, -0.012], [0.045, 0.02], [0.045, 0.004], [0, -0.028], [-0.045, 0.004]];
        add('upper_arm.' + s, disc(p, out, 0, 0.006, 0, chev), c ? GOLD : RED, c ? 'foil' : 'card', 0);
      }
      const hand = new THREE.IcosahedronGeometry(0.05, 0); hand.scale(0.8, 1.15, 1.0); hand.translate(wr.x, wr.y - 0.035, wr.z);
      add('hand.' + s, prim(hand, false), WHITE);
      pin('upper_arm.' + s, sh.clone().add(V(sx * 0.064, -0.01, 0)), out);
      pin('forearm.' + s, el.clone().add(V(sx * 0.058, 0, 0)), out);
    }
    // body: coat skirt (hips), waist (spine), chest with buttons and piping, high collar
    const hips = joint('hips'), chest = joint('chest'), neck = joint('neck'), head = joint('head');
    add('hips', prismGeo(V(0, 0.8, 0), V(0, 1.0, 0), 0.2, 0.18, 8, 1, 0.68), NAVY);
    add('hips', prismGeo(V(0, 0.9, 0), V(0, 0.955, 0), 0.188, 0.185, 8, 1, 0.71), WHITE);
    add('hips', disc(V(0, 0.928, 0.135), V(0, 0, 1), 0, 0.01, 0, rect(-0.03, -0.024, 0.03, 0.024)), GOLD, 'foil');
    add('spine', prismGeo(V(0, 1.0, 0), V(0, 1.18, 0), 0.18, 0.19, 8, 1, 0.66), NAVY);
    add('chest', prismGeo(V(0, 1.18, 0), V(0, 1.36, 0), 0.19, 0.17, 8, 1, 0.66), NAVY);
    add('chest', prismGeo(V(0, 1.34, 0), V(0, 1.41, 0), 0.075, 0.07, 8), NAVY);
    add('chest', prismGeo(V(0, 1.395, 0), V(0, 1.41, 0), 0.078, 0.078, 8), RED);
    add('spine', stripGeo(V(0, 1.0, 0.125), V(0, 1.18, 0.125), V(0, 0, 1), 0.0, 0.016), RED);
    add('chest', stripGeo(V(0, 1.18, 0.125), V(0, 1.34, 0.115), V(0, 0, 1), 0.0, 0.016), RED);
    for (let i = 0; i < 5; i++) { const y = 1.02 + i * 0.07, z = 0.131 - (y > 1.18 ? (y - 1.18) * 0.06 : 0); add(y > 1.18 ? 'chest' : 'spine', disc(V(0.032, y, z), V(0, 0, 1), 0.014, 0.008, 10), GOLD, 'foil'); add(y > 1.18 ? 'chest' : 'spine', disc(V(-0.032, y, z), V(0, 0, 1), 0.014, 0.008, 10), GOLD, 'foil'); }
    // head: a faceted papercraft head with cut-and-glued face, ears, hair
    const hc = V(0, 1.53, 0.01);
    const hg = new THREE.IcosahedronGeometry(0.125, 1); hg.scale(1, 1.1, 0.97); hg.translate(hc.x, hc.y, hc.z);
    add('head', prim(hg, false), SKIN);
    add('neck', prismGeo(V(0, 1.36, 0), V(0, 1.45, 0), 0.05, 0.048, 6), SKIN);
    for (const e of [-1, 1]) {
      add('head', disc(V(e * 0.044, 1.545, 0.123), V(e * 0.18, 0.05, 1).normalize(), 0.017, 0.008, 10), BLACK, 'foil');
      add('head', disc(V(e * 0.04, 1.552, 0.128), V(e * 0.18, 0.05, 1).normalize(), 0.006, 0.006, 6), WHITE);
      add('head', disc(V(e * 0.076, 1.5, 0.108), V(e * 0.5, -0.1, 1).normalize(), 0.022, 0.006, 12), CHEEK);
      add('head', disc(V(e * 0.126, 1.53, 0.0), V(e, 0, 0), 0, 0.01, 0, ellipse(0, 0, 0.03, 0.045, 12)), SKIN);
    }
    add('head', disc(V(0, 1.47, 0.122), V(0, -0.2, 1).normalize(), 0, 0.006, 0, [[-0.035, 0.008], [0, -0.012], [0.035, 0.008], [0.03, 0.0], [0, -0.004], [-0.03, 0.0]]), 0x8a2a2a);
    const nose = new THREE.ConeGeometry(0.018, 0.035, 3); nose.rotateX(Math.PI / 2); nose.translate(0, 1.512, 0.135); add('head', prim(nose, false), SKIN);
    const hair = new THREE.CylinderGeometry(0.129, 0.124, 0.1, 10, 1, true, Math.PI * 0.62, Math.PI * 0.76); hair.translate(0, 1.585, 0.0); add('head', prim(hair, false), HAIR);
    // the dress cap: white folded crown, black band, cut visor, gilt emblem
    add('head', prismGeo(V(0, 1.62, -0.005), V(0, 1.68, -0.01), 0.128, 0.13, 10), BLACK, 'foil');
    add('head', prismGeo(V(0, 1.675, -0.01), V(0, 1.72, -0.02), 0.135, 0.165, 10, 1, 1), WHITE);
    add('head', disc(V(0, 1.722, -0.02), V(0, 1, 0), 0.165, 0.01, 10), WHITE);
    add('head', disc(V(0, 1.655, 0.14), V(0, -0.3, 1).normalize(), 0, 0.01, 0, ellipse(0, 0, 0.022, 0.026, 10)), GOLD, 'foil');
    const visor = slab([[-0.11, 0], [0.11, 0], [0.09, 0.07], [0, 0.09], [-0.09, 0.07]], null, 0.01);
    visor.applyMatrix4(M([0, 1.625, 0.1], [Math.PI / 2 - 0.35, 0, 0])); add('head', visor, BLACK, 'foil');
    pin('head', V(0, 1.45, 0.06), V(0, -0.4, 1).normalize());

    for (const { bone, kind, b } of Object.values(batches)) part(bone, b.mesh(kind === 'foil' ? foil : card));
  });
  rig.root.scale.setScalar(1.0);
  return rig;
}
