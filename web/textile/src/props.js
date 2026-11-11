// Street furniture and set dressing for the textile corner, at Toy Town's own positions (from corner.json).
// Each is built like the real object: a felt-branch tree with wooden ornaments and a stuffed star, a turned-wood lamp
// with fabric panes, a bench of painted slats with a quilted cushion, a wagon of painted wood, a street of cut stones.
import * as THREE from 'three';
import { rect, roundRect, star, M, V, TAU, rng, prim } from './vendor/kit.js';
import { C, holly, wreath, bow } from './buildings.js';

/** the town Christmas tree: a felt-branch fir in a painted crate, wooden-button ornaments, bows, warm beads, a yarn garland, a stuffed star */
export function christmasTree(k, sk, x, z, h = 3.2) {
  const base = M([x, 0, z]), r = rng(4);
  k.solid(new THREE.BoxGeometry(0.72, 0.42, 0.72), base.clone().multiply(M([0, 0.21, 0])), C.red, { batch: 'paint', smooth: false });
  for (const y of [0.08, 0.34]) k.solid(new THREE.BoxGeometry(0.74, 0.05, 0.74), base.clone().multiply(M([0, y, 0])), 0x8a2a2a, { batch: 'paint', smooth: false });
  const H = h - 0.3, R = 1.2;
  k.feltFir(x, 0.3, z, H, { R, tiers: 10, col: 0x1d5233, col2: 0x245c3a, light: 0x2f6e45, seed: 11, snow: 0.25, dowel: true });
  // ornaments hang from branch tips (ring by ring, the radius of each tier)
  const tierR = (t) => R * (1 - t * 0.8) + 0.06, tierY = (t) => 0.3 + H * 0.2 + t * H * 0.72;
  for (let i = 0; i < 30; i++) {
    const t = 0.05 + 0.85 * r(), a = r() * TAU, d = tierR(t) * 0.8, y = tierY(t) - 0.42 * tierR(t) * 0.55, p = V(x + Math.cos(a) * d, y, z + Math.sin(a) * d);
    const F = new THREE.Matrix4().lookAt(V(0, 0, 0), V(-Math.cos(a), 0, -Math.sin(a)), V(0, 1, 0)).setPosition(p);
    if (i % 6 === 5) bow(k, F, [C.berry, C.gold, 0x3d6fb0][i % 3], 0.75);
    else { k.button(F, 0, 0, 0, 0.055, [C.berry, C.gold, 0x3d6fb0, C.cream, 0x2f7a4c][i % 5]); k.S.add(p.clone().add(V(0, 0.05, 0)), p.clone().add(V(0, 0.13, 0)), C.thread, 0.005); }
  }
  for (let i = 0; i < 40; i++) { const t = r() * 0.95, a = r() * TAU, d = tierR(t) * (0.6 + 0.3 * r()); sk.lights.add(new THREE.SphereGeometry(0.03, 6, 4), M([x + Math.cos(a) * d, tierY(t) - 0.3 * d * 0.5, z + Math.sin(a) * d]), i % 3 ? 0xffd28a : 0xffb070, { vary: 0.03, extra: (i * 0.37) % 1 }); }
  const pts = []; for (let u = 0; u <= 1.0001; u += 0.025) { const t = 0.08 + u * 0.78, a = u * TAU * 2.6, d = tierR(t) * 0.78; pts.push(V(x + Math.cos(a) * d, tierY(t) - 0.12 - 0.08 * Math.abs(Math.sin(u * TAU * 5.2)), z + Math.sin(a) * d)); }
  k.yarn(pts, 0.016, 0xc23a3a);
  const st = star(0, 0, 0.27, 0.12, 5), SP = M([x, 0.3 + H + 0.12, z]);
  k.pillow(st, 0.05, SP, C.gold, { flat: 2.5, rings: 3, step: 0.03, amp: 0.004 });
  k.S.blanket(SP, st, 0.0, 0x9a6a20, { step: 0.045, depth: 0.03, r: 0.006 });
  return { top: V(x, h + 0.2, z) };
}

/** a street lamp of turned, painted wood: a lantern with glowing fabric panes, a wreath, batting on the cap */
export function lamp(k, sk, x, z, h = 3.3) {
  const base = M([x, 0, z]), green = 0x2d4a3e;
  const prof = [[0.0, 0], [0.24, 0], [0.24, 0.06], [0.19, 0.1], [0.19, 0.22], [0.13, 0.28], [0.1, 0.42], [0.075, 0.5], [0.075, 0.52], [0, 0.52]].map(([a, b]) => new THREE.Vector2(a, b));
  k.solid(new THREE.LatheGeometry(prof, 14), base, green, { batch: 'paint', smooth: false });
  k.solid(new THREE.CylinderGeometry(0.055, 0.065, h - 0.95, 10), base.clone().multiply(M([0, 0.5 + (h - 0.95) / 2, 0])), green, { batch: 'paint' });
  for (const y of [1.1, 2.0]) k.solid(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 12), base.clone().multiply(M([0, y, 0])), C.gold, { batch: 'paint', smooth: false });
  const ly = h - 0.45, lw = 0.42, lh = 0.52, L = base.clone().multiply(M([0, ly, 0]));
  k.solid(new THREE.BoxGeometry(lw + 0.08, 0.05, lw + 0.08), L.clone().multiply(M([0, 0.025, 0])), green, { batch: 'paint', smooth: false });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.solid(new THREE.BoxGeometry(0.04, lh, 0.04), L.clone().multiply(M([sx * lw / 2, 0.05 + lh / 2, sz * lw / 2])), green, { batch: 'paint', smooth: false });
  for (let f = 0; f < 4; f++) sk.lamp.add(prim(new THREE.PlaneGeometry(lw - 0.03, lh - 0.02)), L.clone().multiply(M([0, 0, 0], [0, f * Math.PI / 2, 0])).multiply(M([0, 0.05 + lh / 2, lw / 2 - 0.01])), 0xffd8a0, { vary: 0.02 });
  const roof = new THREE.ConeGeometry(0.36, 0.3, 4, 1); roof.rotateY(Math.PI / 4);
  k.solid(roof, L.clone().multiply(M([0, 0.05 + lh + 0.15, 0])), green, { batch: 'paint', smooth: false });
  k.lump(0.24, 0.1, 0.24, L.clone().multiply(M([0, 0.05 + lh + 0.2, 0])), C.white, { batch: 'batt', detail: 2, amp: 0.25 });
  k.solid(new THREE.SphereGeometry(0.05, 10, 8), L.clone().multiply(M([0, 0.05 + lh + 0.36, 0])), C.gold, { batch: 'paint' });
  wreath(k, base.clone().multiply(M([0, 1.55, 0.08])), 0.8);
  k.lump(0.3, 0.07, 0.3, base.clone().multiply(M([0, 0.06, 0])), C.white, { batch: 'batt', detail: 2, amp: 0.3 });
  return { light: V(x, ly + 0.05 + lh / 2, z) };
}

/** a bench of painted slats on wooden legs, a quilted cushion tied on, a little batting on the back rail */
export function bench(k, x, y, z, rot) {
  const B = M([x, y, z], [0, rot, 0]), wood = 0x7a4b2a, L = 1.7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.solid(new THREE.BoxGeometry(0.07, 0.45, 0.07), B.clone().multiply(M([sx * (L / 2 - 0.12), 0.225, sz * 0.2])), 0x4f301c, { batch: 'paint', smooth: false });
  for (let i = 0; i < 3; i++) k.solid(new THREE.BoxGeometry(L, 0.035, 0.13), B.clone().multiply(M([0, 0.46, -0.16 + i * 0.16], [0, 0, (k.r() - 0.5) * 0.01])), wood, { batch: 'paint', smooth: false });
  for (let i = 0; i < 2; i++) k.solid(new THREE.BoxGeometry(L, 0.12, 0.035), B.clone().multiply(M([0, 0.68 + i * 0.17, -0.27], [-0.12, 0, 0])), wood, { batch: 'paint', smooth: false });
  k.pillow(roundRect(-0.7, -0.19, 0.7, 0.19, 0.06), 0.05, B.clone().multiply(M([0, 0.49, 0], [-Math.PI / 2, 0, 0])), 0xb4545a, { batch: 'print', extra: 0, rings: 3, flat: 5 });
  for (const xx of [-0.35, 0, 0.35]) k.S.knot(B.clone().multiply(M([xx, 0.545, 0], [-Math.PI / 2, 0, 0])), 0, 0, 0, 0.018, C.cream);
  k.drape(B.clone().multiply(M([0, 0.9, -0.3], [-Math.PI / 2 + 0.12, 0, 0])), -L / 2, L / 2, -0.05, 0.08, { thick: 0.06, edge: 0.08, rag: 0.08, res: 0.08 });
}

/** a little pull wagon of painted wood with button wheels, a felt blanket and two stuffed toys in it */
export function wagon(k, x, z, rot) {
  const W = M([x, 0, z], [0, rot, 0]), red = 0xa8322f, Lx = 1.25, Ly = 0.78, z0 = 0.33;
  k.solid(new THREE.BoxGeometry(Lx, 0.06, Ly), W.clone().multiply(M([0, z0, 0])), red, { batch: 'paint', smooth: false });
  for (const s of [-1, 1]) { k.solid(new THREE.BoxGeometry(Lx, 0.3, 0.06), W.clone().multiply(M([0, z0 + 0.15, s * Ly / 2])), red, { batch: 'paint', smooth: false }); k.solid(new THREE.BoxGeometry(0.06, 0.3, Ly), W.clone().multiply(M([s * Lx / 2, z0 + 0.15, 0])), red, { batch: 'paint', smooth: false }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const g = new THREE.CylinderGeometry(0.19, 0.19, 0.05, 16); g.rotateX(Math.PI / 2); k.solid(g, W.clone().multiply(M([sx * 0.42, 0.19, sz * (Ly / 2 + 0.06)])), 0x2c2a2a, { batch: 'paint', smooth: false }); k.button(W.clone().multiply(M([sx * 0.42, 0.19, sz * (Ly / 2 + 0.09)], [0, sz > 0 ? 0 : Math.PI, 0])), 0, 0, 0, 0.06, C.gold); }
  k.solid(new THREE.BoxGeometry(0.9, 0.035, 0.035), W.clone().multiply(M([-Lx / 2 - 0.42, 0.42, 0], [0, 0, -0.45])), 0x24302c, { batch: 'paint', smooth: false });
  k.drape(W.clone().multiply(M([0, z0 + 0.04, 0], [-Math.PI / 2, 0, 0])), -Lx / 2 + 0.04, Lx / 2 - 0.04, -Ly / 2 + 0.04, Ly / 2 - 0.04, { thick: 0.06, edge: 0.1, rag: 0.05, res: 0.08, color: 0x6f8f7c });
  return { top: z0 + 0.1 };
}

/** the corner's stretch of street: cut stones between Toy Town's own curbs, a stuffed tweed kerb on the shop side,
 *  batting drifts along both edges (replacing the clay crust) */
export function street(k, { x0, x1, near, far }) {
  k.cutStones(x0, x1, (x) => [near(x) + 0.1, far(x) - 0.1], { y: 0.006, seed: 7, course: 0.38, stone: 0.5 });   // laid on the street bed (z = 0.005 in the clay village)
  const pts = []; for (let x = x0; x <= x1; x += 0.25) pts.push(V(x, 0.03, near(x)));
  k.yarnTube(pts, 0.085, 0x7a7480, { closed: false });
  const r = rng(12);
  for (let x = x0; x < x1; x += 0.32 + r() * 0.2) for (const [edge, s] of [[near, -1], [far, 1]]) {
    if (r() < 0.3) continue;
    const zz = edge(x) + s * (0.12 + r() * 0.2), sz = 0.16 + r() * 0.16;
    k.lump(sz * 1.6, sz * 0.45, sz, M([x + (r() - 0.5) * 0.1, 0.02, zz]), 0xf7f4ee, { batch: 'batt', detail: 2, amp: 0.35 });
  }
}
