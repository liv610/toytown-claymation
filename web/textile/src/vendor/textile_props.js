// Copied from experiment/textile-storybook @ d509733 (web/handmade/src). Kept as-is so the port can be traced;
// the project's own textile system builds on it in ../*.js.
// Experiment C — props: the tree, the lamp, presents and a sled, the street and its small details.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rect, roundRect, circle, ellipse, star, M, V, TAU, rng, slab, handCut, prim } from './kit.js';
import { TF, fbm3js } from './textile_kit.js';
import { C, holly, wreath, bow } from './textile_build.js';
import { TREE, LAMP, SHOP, PINK } from './layout.js';

// street of this experiment: narrower and more intimate than the other two
export const LANE = { x0: -16, x1: 18, walk: 1.3, road0: 1.6, road1: 4.75, walk2: 5.9 };

/** a pinked (zig-zag) disc, drooped into a shallow cone: one layer of the felt tree */
function pinkedDisc(R, teeth, droop, seed) {
  const pts = []; for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, r = (i % 2 ? R * 0.86 : R) * (1 + 0.04 * Math.sin(i * 1.7 + seed)); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  let g = slab(handCut(pts, { amp: R * 0.02, wave: R * 0.5, seed }), [circle(0, 0, 0.035, 8)], 0.045, { bevel: 0.012, bevelSeg: 1, smoothNormals: true });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y) / R; p.setZ(i, p.getZ(i) - droop * r * r); }
  g.computeVertexNormals();
  return g;
}
// ------------------------------------------------------------------ the Christmas tree: stacked felt discs on a wooden dowel
export function tree(k, sk) {
  const { x, z, h } = TREE, base = M([x, 0, z]), r = rng(4);
  // a little painted crate, a burlap skirt, the dowel
  k.solid(new THREE.BoxGeometry(0.7, 0.42, 0.7), base.clone().multiply(M([0, 0.21, 0])), C.red, { batch: 'paint', smooth: false });
  for (const y of [0.08, 0.34]) k.solid(new THREE.BoxGeometry(0.72, 0.05, 0.72), base.clone().multiply(M([0, y, 0])), 0x8a2a2a, { batch: 'paint', smooth: false });
  k.solid(new THREE.CylinderGeometry(0.035, 0.04, h + 0.1, 8), base.clone().multiply(M([0, (h + 0.1) / 2 + 0.3, 0])), C.wood, { batch: 'paint', smooth: false });
  const N = 16, layers = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), R = 1.22 * (1 - t) ** 0.95 + 0.16, y = 0.72 + t * (h - 0.75);
    const P = base.clone().multiply(M([0, y, 0], [-Math.PI / 2, 0, r() * TAU]));
    k.B.felt.add(pinkedDisc(R, Math.round(12 + R * 12), 0.3 + R * 0.22, i), P, i % 2 ? 0x2b6a40 : 0x22583a, { vary: 0.05 });
    k.B.felt.add(pinkedDisc(R * 0.66, Math.round(9 + R * 9), 0.2 + R * 0.16, i + 50), P.clone().multiply(M([0, 0, 0.05])), i % 2 ? 0x4a9258 : 0x3c8450, { vary: 0.06 });
    layers.push({ y, R });
    // cotton tufts caught on a few tips
    const tufts = Math.round(R * 4);
    for (let j = 0; j < tufts; j++) { const a = r() * TAU, d = R * (0.55 + 0.3 * r()); k.lump(0.09 + 0.05 * r(), 0.04, 0.07, base.clone().multiply(M([Math.cos(a) * d, y - 0.12 * (d / R) ** 2 * (0.3 + R * 0.22) / 0.3 + 0.07, Math.sin(a) * d])), C.white, { batch: 'batt', detail: 1, amp: 0.25 }); }
  }
  // ornaments: painted wooden buttons hung from the disc edges, a few fabric bows, tiny warm lights
  for (let i = 0; i < 26; i++) {
    const L = layers[(r() * (N - 2)) | 0], a = r() * TAU, d = L.R * 0.93, p = V(x + Math.cos(a) * d, L.y - (0.3 + L.R * 0.22) * 0.86 - 0.06, z + Math.sin(a) * d);
    const F = new THREE.Matrix4().lookAt(V(0, 0, 0), V(-Math.cos(a), 0, -Math.sin(a)), V(0, 1, 0)).setPosition(p);
    if (i % 6 === 5) bow(k, F, [C.berry, C.gold, 0x3d6fb0][i % 3], 0.75);
    else { k.button(F, 0, 0, 0, 0.055, [C.berry, C.gold, 0x3d6fb0, C.cream, 0x2f7a4c][i % 5]); k.S.add(p.clone().add(V(0, 0.05, 0)), p.clone().add(V(0, 0.13, 0)), C.thread, 0.005); }
  }
  for (let i = 0; i < 36; i++) { const L = layers[(r() * (N - 1)) | 0], a = r() * TAU, d = L.R * (0.75 + 0.2 * r()); sk.lights.add(new THREE.SphereGeometry(0.03, 6, 4), M([x + Math.cos(a) * d, L.y - (0.3 + L.R * 0.22) * (d / L.R) ** 2 + 0.03, z + Math.sin(a) * d]), r() < 0.5 ? 0xffd28a : (r() < 0.5 ? 0xffa070 : 0xfff0c8), { vary: 0.04, extra: r() }); }
  // a twisted red yarn garland, swagged from disc to disc
  const pts = [];
  for (let u = 0; u <= 1.0001; u += 0.025) { const t = 0.08 + u * 0.75, R = 1.22 * (1 - t) ** 0.95 + 0.16, y = 0.72 + t * (h - 0.75), a = u * TAU * 2.6, swag = 0.12 * Math.abs(Math.sin(u * TAU * 2.6 * 2)); pts.push(V(x + Math.cos(a) * R * 0.86, y - (0.3 + R * 0.22) * 0.74 - swag, z + Math.sin(a) * R * 0.86)); }
  k.yarn(pts, 0.016, 0xc23a3a);
  // the star: two layers of gold felt, stuffed and blanket-stitched together
  const st = star(0, 0, 0.27, 0.12, 5), SP = M([x, h + 0.22, z]);
  k.pillow(st, 0.05, SP, C.gold, { flat: 2.5, rings: 3, step: 0.03, amp: 0.004 });
  k.S.blanket(SP, st, 0.0, 0x9a6a20, { step: 0.045, depth: 0.03, r: 0.006 });
  k.S.knot(SP, 0, 0, 0.052, 0.02, C.berry);
  return { top: V(x, h + 0.2, z) };
}

// ------------------------------------------------------------------ the lamp: turned and painted wood, a lantern with fabric panes
export function lamp(k, sk) {
  const { x, z, h } = LAMP, base = M([x, 0, z]), green = 0x2d4a3e;
  const prof = [[0.0, 0], [0.24, 0], [0.24, 0.06], [0.19, 0.1], [0.19, 0.22], [0.13, 0.28], [0.1, 0.42], [0.075, 0.5], [0.075, 0.52], [0, 0.52]].map(([a, b]) => new THREE.Vector2(a, b));
  k.solid(new THREE.LatheGeometry(prof, 14), base, green, { batch: 'paint', smooth: false });
  k.solid(new THREE.CylinderGeometry(0.055, 0.065, h - 0.95, 10), base.clone().multiply(M([0, 0.5 + (h - 0.95) / 2, 0])), green, { batch: 'paint' });
  for (const y of [1.1, 2.0]) k.solid(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 12), base.clone().multiply(M([0, y, 0])), C.gold, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(0.5, 0.04, 0.05), base.clone().multiply(M([0, h - 0.5, 0])), green, { batch: 'paint', smooth: false });
  for (const s of [-1, 1]) k.solid(new THREE.SphereGeometry(0.04, 8, 6), base.clone().multiply(M([s * 0.26, h - 0.5, 0])), C.gold, { batch: 'paint' });
  // lantern
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

// ------------------------------------------------------------------ presents (soft boxes wrapped in calico, satin ribbon, fabric bows) and a sled
const GIFTS = [
  { p: [-1.5, 0.95], s: [0.48, 0.4, 0.42], r: 0.25, c: 0xb4545a, rib: 0xe8c25a, print: 1 },
  { p: [-1.05, 1.08], s: [0.34, 0.28, 0.34], r: -0.35, c: 0x5e7896, rib: 0xf3ead8, print: 2 },
  { p: [-3.2, 2.3], s: [0.52, 0.38, 0.46], r: 0.5, c: 0x6f8f7c, rib: 0xc23a3a, print: 0 },
  { p: [-4.2, 2.35], s: [0.4, 0.46, 0.4], r: -0.2, c: 0xd7a35a, rib: 0xb8262c, print: 3 },
  { p: [-3.7, 2.8], s: [0.32, 0.24, 0.32], r: 0.9, c: 0x8a5a7a, rib: 0xf3ead8, print: 1 },
];
export function presents(k) {
  for (const g of GIFTS) {
    const [w, h, d] = g.s, Pm = M([g.p[0], 0, g.p[1]], [0, g.r, 0]);
    // fabric over a soft core: a box with its corners and edges pulled in, not a cube
    const bg = new THREE.BoxGeometry(w, h, d, 5, 5, 5), p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(p.getX(i)) / (w / 2), ay = Math.abs(p.getY(i)) / (h / 2), az = Math.abs(p.getZ(i)) / (d / 2), e = (ax ** 6 * ay ** 6 + ay ** 6 * az ** 6 + ax ** 6 * az ** 6); const k2 = 1 - 0.09 * e; p.setXYZ(i, p.getX(i) * k2, p.getY(i) * k2 + (ay > 0.99 && p.getY(i) > 0 ? -0.015 * (1 - Math.max(ax, az) ** 2) : 0), p.getZ(i) * k2); }
    k.solid(bg, Pm.clone().multiply(M([0, h / 2, 0])), g.c, { batch: 'print', extra: g.print });
    for (const ax of [0, 1]) k.solid(new THREE.BoxGeometry(ax ? 0.06 : w + 0.012, h + 0.01, ax ? d + 0.012 : 0.06), Pm.clone().multiply(M([0, h / 2, 0])), g.rib, { batch: 'woven', smooth: false });
    bow(k, Pm.clone().multiply(M([0, h + 0.02, 0], [-Math.PI / 2 + 0.5, 0, 0])), g.rib, 1.0);
  }
  // a wooden sled with two presents, left by the pink house
  const S = M([PINK.x + 2.25, 0, 1.0], [0, -0.5, 0]);
  for (const s of [-1, 1]) { const run = new THREE.TorusGeometry(0.12, 0.022, 6, 12, Math.PI); run.rotateZ(Math.PI / 2); run.scale(1, 1, 1); k.solid(new THREE.BoxGeometry(0.04, 0.03, 0.9), S.clone().multiply(M([s * 0.22, 0.02, 0])), C.berry, { batch: 'paint', smooth: false }); k.solid(run, S.clone().multiply(M([s * 0.22, 0.13, 0.45], [0, Math.PI / 2, 0])), C.berry, { batch: 'paint', smooth: false }); for (const zz of [-0.3, 0.2]) k.solid(new THREE.BoxGeometry(0.03, 0.12, 0.03), S.clone().multiply(M([s * 0.22, 0.09, zz])), C.berry, { batch: 'paint', smooth: false }); }
  for (let i = 0; i < 4; i++) k.solid(new THREE.BoxGeometry(0.56, 0.025, 0.12), S.clone().multiply(M([0, 0.16, -0.36 + i * 0.22])), C.woodL, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(0.34, 0.26, 0.3), S.clone().multiply(M([0, 0.31, -0.18], [0, 0.2, 0])), 0xc77a5e, { batch: 'print' });
  k.solid(new THREE.BoxGeometry(0.06, 0.27, 0.31), S.clone().multiply(M([0, 0.31, -0.18], [0, 0.2, 0])), 0xf3ead8, { batch: 'woven', smooth: false });
  k.solid(new THREE.BoxGeometry(0.26, 0.2, 0.26), S.clone().multiply(M([0.02, 0.27, 0.2], [0, -0.3, 0])), 0x5e7896, { batch: 'print' });
  k.yarn([V(0, 0.15, 0.55), V(0.1, 0.12, 0.85), V(0.05, 0.03, 1.15), V(-0.15, 0.02, 1.35)].map((p) => p.applyMatrix4(S)), 0.012, 0xd9c79a);
}

// ------------------------------------------------------------------ the lane: cut-cloth stones on batting, snow in the joints, small lost things
export function street(k) {
  const { x0, x1, walk, road0, road1, walk2 } = LANE, r = rng(33);
  const stoneCols = [0x8c8590, 0x847e8a, 0x928b94, 0x8a8e9c, 0x8e857c, 0x968e92];
  const stone = (cx, cz, w, d, gapK, col, batch) => {
    const n = 11, pts = [], ph = r() * 6;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, rr = 1 + 0.1 * Math.sin(a * 2 + ph) + 0.06 * Math.sin(a * 3 + ph * 2); pts.push([Math.cos(a) * w / 2 * rr * (Math.abs(Math.cos(a)) ** 0.25), Math.sin(a) * d / 2 * rr * (Math.abs(Math.sin(a)) ** 0.25)]); }
    const g = slab(pts, null, 0.034, { bevel: 0.014, bevelSeg: 1, smoothNormals: true });
    k.B[batch].add(g, M([cx, 0.006, cz], [-Math.PI / 2, 0, r() * TAU]).multiply(M([0, 0, 0], [0, 0, 0], gapK)), col, { vary: 0.07 });
  };
  // road: an irregular running bond of felt and tweed "stones", larger near the middle, the gaps wider at the edges
  for (let zz = road0 + 0.22; zz < road1 - 0.12; zz += 0.38) {
    const edge = Math.min(zz - road0, road1 - zz), gapK = edge < 0.5 ? 0.86 : 0.97;
    for (let xx = x0 + (r() * 0.3); xx < x1; xx += 0.5 + r() * 0.08) {
      if (r() < 0.05) continue;    // a missing stone, filled with snow
      stone(xx + (r() - 0.5) * 0.04, zz + (r() - 0.5) * 0.04, 0.52 + r() * 0.1, 0.38 + r() * 0.05, gapK, stoneCols[(r() * stoneCols.length) | 0], r() < 0.4 ? 'woven' : 'felt');
    }
  }
  // pavements: larger flags of warm tweed (front) and grey felt (far side)
  for (const [za, zb, col, batch] of [[0.2, walk, 0xb3a796, 'woven'], [road1 + 0.35, walk2, 0xa59a8e, 'felt']]) {
    for (let zz = za + 0.28; zz < zb; zz += 0.58) for (let xx = x0; xx < x1; xx += 0.62 + r() * 0.1) {
      if (za < 1 && xx > -1.0 && xx < 0.95 && zz < 0.85) continue;
      const g = slab(handCut(roundRect(-0.28, -0.24, 0.28, 0.24, 0.05), { amp: 0.012, wave: 0.2, seed: (r() * 1e5) | 0 }), null, 0.03, { bevel: 0.01, bevelSeg: 1, smoothNormals: true });
      k.B[batch].add(g, M([xx + 0.3, 0.006, zz], [-Math.PI / 2, 0, (r() - 0.5) * 0.05]), col, { vary: 0.07 });
    }
  }
  // kerbs: stuffed rolls of grey tweed
  for (const zz of [walk + 0.15, road1 + 0.2]) { const g = new THREE.CylinderGeometry(0.09, 0.09, x1 - x0, 10, 1); g.rotateZ(Math.PI / 2); g.scale(1, 0.8, 1); k.solid(g, M([(x0 + x1) / 2, 0.06, zz]), 0x7a7480, { batch: 'woven' }); }
  // a low picket fence of painted wood on the far side, with snow along its rail
  for (let xx = -9; xx < 13; xx += 0.24) { if (xx > 1.5 && xx < 3.5) continue; const pk = [[-0.045, 0], [0.045, 0], [0.045, 0.5], [0, 0.56], [-0.045, 0.5]]; k.cut(pk, null, M([xx, 0, walk2 + 0.25]), 0xf1ead8, { batch: 'paint', t: 0.025, amp: 0.004 }); }
  for (const y of [0.16, 0.38]) { k.solid(new THREE.BoxGeometry(9.5, 0.05, 0.03), M([-9 + 4.75 + 0.6, y, walk2 + 0.22]), 0xe6dcc6, { batch: 'paint', smooth: false }); k.solid(new THREE.BoxGeometry(9.3, 0.05, 0.03), M([3.6 + 4.75, y, walk2 + 0.22]), 0xe6dcc6, { batch: 'paint', smooth: false }); }
  // small lost things: footprints in the snow, a dropped ribbon, a red mitten, pine needles by the tree, a wooden button
  for (let i = 0; i < 9; i++) { const xx = -6.5 + i * 0.55, zz = road1 + 0.95 + (i % 2) * 0.16; k.cut(ellipse(0, 0, 0.055, 0.12, 12), null, M([xx, 0.045, zz], [-Math.PI / 2, 0, Math.PI / 2 + 0.1]), 0xd9dbe6, { batch: 'batt', t: 0.008, bevel: 0.003, amp: 0.004 }); }
  const rib = []; for (let i = 0; i <= 20; i++) { const t = i / 20; rib.push(V(1.6 + t * 0.9, 0.012, 1.0 + 0.18 * Math.sin(t * 7.0))); }
  for (let i = 0; i < 20; i++) { const a = rib[i], b = rib[i + 1], d = b.clone().sub(a), L = d.length(); const g = new THREE.BoxGeometry(L + 0.01, 0.006, 0.045); g.rotateY(-Math.atan2(d.z, d.x)); k.solid(g, M([(a.x + b.x) / 2, 0.015 + 0.006 * Math.sin(i), (a.z + b.z) / 2], [0, 0, 0.05 * Math.sin(i * 1.3)]), C.berry, { batch: 'woven', smooth: false }); }
  k.pillow([[-0.07, -0.1], [0.07, -0.1], [0.08, 0.04], [0.11, 0.06], [0.1, 0.11], [0.05, 0.09], [0.0, 0.13], [-0.07, 0.08]], 0.03, M([6.3, 0.04, 1.05], [-Math.PI / 2, 0, 0.6]), C.berry, { rings: 3, flat: 3, step: 0.03 });
  k.S.running(M([6.3, 0.07, 1.05], [-Math.PI / 2, 0, 0.6]), [[-0.07, -0.07], [0.07, -0.07]], 0, C.white, { len: 0.02, gap: 0.012, r: 0.006 });
  for (let i = 0; i < 46; i++) { const a = r() * TAU, d = 0.7 + r() * 1.0, p = V(TREE.x + Math.cos(a) * d, 0.045, TREE.z + Math.sin(a) * d), b = r() * TAU; k.S.add(p, p.clone().add(V(Math.cos(b) * 0.07, 0, Math.sin(b) * 0.07)), r() < 0.6 ? 0x2f6a3e : 0x4a7a46, 0.006, V(0, 1, 0)); }
  k.button(M([-0.6, 0.04, 1.9], [-Math.PI / 2, 0, 0]), 0, 0, 0, 0.04, 0xc9a26a);
}

// ------------------------------------------------------------------ garlands: twisted yarn swags with wooden buttons and little warm lights
export function garlands(k, sk) {
  const swag = (a, b, sag, n = 28) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(a.clone().lerp(b, t).add(V(0, -sag * Math.sin(t * Math.PI), 0))); } return pts; };
  const dress = (pts, every = 4, phase = 0) => {
    k.yarn(pts, 0.018, 0x2f6a3e);
    pts.forEach((p, i) => {
      if (i === 0 || i === pts.length - 1) return;
      if ((i + phase) % every === 0) { const F = new THREE.Matrix4().lookAt(V(0, 0, 0), V(0, 0, -1), V(0, 1, 0)).setPosition(p.clone().add(V(0, -0.07, 0.02))); k.button(F, 0, 0, 0, 0.038, [C.berry, C.gold, C.cream][i % 3]); }
      else if ((i + phase) % 2 === 1) sk.lights.add(new THREE.SphereGeometry(0.026, 6, 4), M([p.x, p.y - 0.04, p.z + 0.02]), i % 3 ? 0xffd28a : 0xffb070, { vary: 0.04, extra: (i * 0.37) % 1 });
    });
  };
  // across the alley, from the shop's corner to the pink house's
  dress(swag(V(2.62, 4.25, 0.25), V(3.92, 3.82, -0.2), 0.32, 14), 4, 1);
  // along the pink house eave, in three swags
  const y = 3.7, z = -0.45 + 0.42, xs = [3.95, 5.3, 6.6, 7.95];
  for (let i = 0; i < 3; i++) dress(swag(V(xs[i], y, z), V(xs[i + 1], y, z), 0.24, 14), 4, i);
}
