// Experiment C — the village around the hero street: neighbours, rows of rooftops climbing behind, an alley,
// a clock tower, felt trees, batting snow everywhere, a twilight sky. Everything here is deliberately cheap
// (plain slabs, coarse drapes, glow patches instead of real openings): it is read through haze and depth of field.
import * as THREE from 'three';
import { rect, roundRect, circle, arch, M, V, TAU, rng, slab, handCut, prim } from '../kit.js';
import { fbm3js } from './kit.js';
import { C } from './build.js';
import { LANE } from './props.js';

export function groundHeight(x, z) {
  let y = z > -6.5 ? 0 : Math.pow(-6.5 - z, 1.2) * 0.11;
  if (z > -0.4 && z < LANE.walk2 + 0.25 && x > LANE.x0 + 1 && x < LANE.x1 - 1) return -0.006;   // the lane (stones lie on it)
  y += 0.05 * fbm3js(x * 0.5, z * 0.5, 3, 7);
  if (z >= LANE.walk2 + 0.25) y += Math.min(0.35, (z - LANE.walk2 - 0.25) * 0.25) * (0.7 + 0.6 * fbm3js(x * 0.7, z * 0.7, 1, 2));
  if (z > -1.2 && z <= -0.4) y += 0.12 * (0.6 + 0.8 * fbm3js(x * 1.3, 0, 2, 2));
  return y;
}

/** a background house: felt or cloth walls, glowing windows, a roof with a coarse batting drape */
function house(k, x, z, W, D, H, wallCol, roofCol, { gableFront = true, batch = 'felt', windows = 'mid', rot = 0, pitch = 0.85, door = true, seed = 1 } = {}) {
  const y0 = groundHeight(x, z) - 0.05, r = rng(seed), Mb = M([x, y0, z], [0, rot, 0]).multiply(M([0, 0, 0], [0.004 * (r() - 0.5), 0, 0.01 * (r() - 0.5)]));
  const hw = W / 2, ridgeH = H + (gableFront ? hw : D / 2) * Math.tan(pitch), shutterCol = [0x8a2a2a, 0x2f5a45, 0x3a4a6e, 0x6a4a2a][seed % 4];
  const front = gableFront ? [[-hw, 0], [hw, 0], [hw, H], [0, ridgeH], [-hw, H]] : rect(-hw, 0, hw, H);
  const far = windows === 'far', o = { batch, amp: far ? 0 : 0.02, wave: 0.8, t: 0.06, bevel: 0.015, seg: 1 };
  k.cut(front, null, Mb, wallCol, o);
  for (const s of [1, -1]) {
    const side = gableFront ? rect(0, 0, D, H) : [[0, 0], [D, 0], [D, H], [D / 2, ridgeH], [0, H]];
    k.cut(side, null, Mb.clone().multiply(M([s * hw, 0, s > 0 ? 0 : -D], [0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0])), wallCol, o);
  }
  // windows: glowing patches with a cardstock frame (mid) or just the glow (far)
  const floors = Math.max(1, Math.floor((H - 0.6) / 1.45)), cols = Math.max(1, Math.floor(W / 1.15));
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
    if (r() < 0.22) continue;
    const cx = -hw + (c + 0.5) * W / cols, cy = 0.8 + f * 1.45, w = 0.42, h = 0.6, lit = r() < 0.78;
    k.B[lit ? 'glow' : 'felt'].add(prim(new THREE.PlaneGeometry(w, h)), Mb.clone().multiply(M([cx, cy + h / 2, 0.062])), lit ? 0xffc27a : 0x3a3550, { vary: 0.08 });
    if (!far) {   // street neighbours: a cardstock frame, felt shutters, a little batting on the sill
      k.cut(rect(cx - w / 2 - 0.07, cy - 0.07, cx + w / 2 + 0.07, cy + h + 0.07), [rect(cx - w / 2, cy, cx + w / 2, cy + h)], Mb.clone().multiply(M([0, 0, 0.065])), C.card, { batch: 'card', t: 0.02, amp: 0.003 });
      for (const sxx of [-1, 1]) k.cut(roundRect(-0.13, 0, 0.13, h + 0.06, 0.03), null, Mb.clone().multiply(M([cx + sxx * (w / 2 + 0.22), cy - 0.03, 0.065], [0, sxx * 0.35, 0])), shutterCol, { t: 0.035, bevel: 0.01, amp: 0.004, seg: 1 });
      k.lump(w * 0.6, 0.04, 0.06, Mb.clone().multiply(M([cx, cy - 0.06, 0.12])), C.white, { batch: 'batt', detail: 1, amp: 0.3 });
    }
  }
  if (door) k.cut(arch(-0.32, 0, 0.32, 1.4, 8), null, Mb.clone().multiply(M([gableFront ? 0 : -hw * 0.45, 0, 0.06])), [0x6a2a2a, 0x2f5a45, 0x3a4a6e][seed % 3], { t: 0.03, amp: 0.006, bevel: 0.008 });
  // roof: two thick felt slabs and a coarse batting drape
  const half = gableFront ? hw : D / 2, run = half + 0.28, len = run / Math.cos(pitch), L = (gableFront ? D : W) + 0.5;
  const R = Mb.clone().multiply(M([0, 0, -D / 2], [0, gableFront ? 0 : Math.PI / 2, 0]));
  for (const s of [1, -1]) {
    const o2 = V(s * run, ridgeH - run * Math.tan(pitch), s * L / 2), u = V(0, 0, -s), v = V(-s * Math.cos(pitch), Math.sin(pitch), 0);
    const PB = R.clone().multiply(new THREE.Matrix4().makeBasis(u, v, new THREE.Vector3().crossVectors(u, v).normalize()).setPosition(o2));
    k.cut(rect(0, 0, L, len), null, PB, roofCol, { t: 0.08, amp: far ? 0 : 0.02, bevel: 0.02, wave: 0.8, seg: 1 });
    k.drape(PB.clone().multiply(M([0, 0, 0.07])), -0.05, L + 0.05, len * (0.3 + 0.2 * r()), len + 0.02, { thick: 0.22, res: far ? 0.45 : 0.25, edge: 0.5, rag: 0.5 });
    if (!far) { const n2 = Math.round(L / 0.34), pts = [[0, 0.02]]; for (let i = 0; i < n2; i++) for (let q = 0; q <= 6; q++) { const a = Math.PI - (q / 6) * Math.PI; pts.push([(i + 0.5 + Math.cos(a) * 0.5) * L / n2, -Math.sin(a) * 0.12]); } pts.push([L, 0.02]); k.cut(pts.reverse(), null, PB.clone().multiply(M([0, 0.0, -0.01])), 0xf1e3c6, { t: 0.035, bevel: 0.01, amp: 0.004, seg: 1 }); }
  }
  if (r() < 0.6) { const cx = (r() - 0.5) * W * 0.5; k.solid(new THREE.BoxGeometry(0.5, 1.4, 0.5), Mb.clone().multiply(M([cx, ridgeH - 0.2, -D * 0.4])), 0x8a4a3a, { smooth: false }); k.lump(0.3, 0.1, 0.3, Mb.clone().multiply(M([cx, ridgeH + 0.55, -D * 0.4])), C.white, { batch: 'batt', detail: 1, amp: 0.3 }); }
}
/** a cheap felt fir: a dowel through a few pinked discs, a cotton tuft on top */
export function fir(k, x, z, h, { y0 = null, layers = 6, col = 0x2a5e3c, seed = 1 } = {}) {
  const yb = y0 ?? groundHeight(x, z), r = rng(seed);
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1), R = h * 0.36 * (1 - t * 0.78), y = yb + h * 0.22 + t * h * 0.68, teeth = 12, pts = [];
    for (let j = 0; j < teeth * 2; j++) { const a = (j / (teeth * 2)) * TAU, rr = j % 2 ? R * 0.84 : R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    const g = slab(pts, null, 0.05, { bevel: 0.015, bevelSeg: 1, smoothNormals: true }), p = g.attributes.position;
    for (let q = 0; q < p.count; q++) { const rr = Math.hypot(p.getX(q), p.getY(q)) / R; p.setZ(q, p.getZ(q) - (0.25 + R * 0.4) * rr * rr); }
    g.computeVertexNormals();
    k.B.felt.add(g, M([x, y, z], [-Math.PI / 2, 0, r() * TAU]), i % 2 ? col : 0x24543a, { vary: 0.06 });
    k.lump(R * 0.5, 0.05, R * 0.5, M([x, y + 0.02, z]), C.white, { batch: 'batt', detail: 1, amp: 0.3 });
  }
  k.solid(new THREE.CylinderGeometry(0.05, 0.06, h * 0.3, 6), M([x, yb + h * 0.15, z]), C.wood, { batch: 'paint', smooth: false });
}

export function town(k, kb, sk) {
  const r = rng(61);
  // neighbours on the street (mid detail)
  house(k, -7.9, -0.5, 3.0, 4.0, 4.6, 0xe7d4b0, 0x8a3a30, { gableFront: true, seed: 2 });
  house(k, -11.6, -0.8, 3.6, 4.2, 5.8, 0x6f8fae, 0x4d4a68, { gableFront: false, batch: 'woven', seed: 3 });
  house(k, -15.4, -0.9, 3.2, 4.0, 4.4, 0xc98a6a, 0x5a3a3a, { gableFront: true, seed: 4 });
  house(k, 10.3, -0.3, 3.6, 4.0, 4.4, 0xd8a94e, 0x5a4a6a, { gableFront: false, batch: 'woven', seed: 5 });
  house(k, 14.1, -0.6, 3.4, 4.2, 5.4, 0x7f9c86, 0x7a3a2e, { gableFront: true, seed: 6 });
  house(k, 17.8, -0.8, 3.4, 4.0, 4.8, 0xe2c6a8, 0x4d4a68, { gableFront: false, batch: 'woven', seed: 7 });
  // the alley between the shop and the pink house ends at a lit back wall with a hanging lantern
  house(kb, 3.25, -6.4, 3.2, 3, 5.6, 0xb7a08a, 0x5a3a3a, { gableFront: false, seed: 8, door: false, windows: 'far' });
  sk.alley = V(3.25, 2.6, -5.5);
  k.cut(roundRect(-0.12, -0.16, 0.12, 0.16, 0.04), null, M([3.25, 2.55, -6.25]), 0xffd08a, { batch: 'glow', t: 0.12, bevel: 0.03, amp: 0 });
  // second row, climbing the hill
  const row2 = [[-15, 0.9], [-11.2, 1.1], [-7.4, 0.95], [-3.4, 1.2], [0.4, 1.0], [4.4, 1.25], [8.4, 0.9], [12.3, 1.15], [16.2, 1.0], [20, 0.9]];
  const wallCols = [0xd9c09a, 0x8a6f9a, 0x6f8fae, 0xc98a6a, 0xe2d6b8, 0x7f9c86, 0xb35a4e, 0xd8a94e, 0x9aa4c4, 0xe7c7b8];
  const roofCols = [0x4d4a68, 0x8a3a30, 0x5a3a3a, 0x3f5a4a, 0x6a4a5a];
  row2.forEach(([x, s], i) => house(kb, x + (r() - 0.5) * 0.6, -9.2 - r() * 0.8, 3.2 + r() * 0.8, 3.5, (4.4 + r() * 2.2) * s, wallCols[i % wallCols.length], roofCols[i % roofCols.length], { gableFront: i % 3 !== 1, batch: i % 2 ? 'woven' : 'felt', windows: 'far', seed: 20 + i }));
  // third row and the clock tower
  for (let i = 0; i < 12; i++) { const x = -22 + i * 4.0 + (r() - 0.5); if (Math.abs(x + 1.8) < 2.4) continue; house(kb, x, -16.5 - r() * 1.2, 3.0 + r(), 3, 4 + r() * 2.5, wallCols[(i + 3) % wallCols.length], roofCols[(i + 1) % roofCols.length], { gableFront: i % 2 === 0, windows: 'far', door: false, seed: 40 + i }); }
  clockTower(kb, -1.8, -14.6);
  // trees: a few in the gaps between houses, a band along the hill
  for (const [x, z, h] of [[-5.6, -2.8, 3.4], [8.25, -2.2, 3.2], [-13.6, -3.0, 4.2], [12.3, -2.8, 4.0], [-4.9, -6.0, 4.4], [6.7, -6.2, 4.6], [-17, -4, 4.8], [19, -4, 4.4]]) fir(k, x, z, h, { layers: 5, seed: (x * 10) | 0 });
  for (let i = 0; i < 22; i++) { const x = -26 + i * 2.6 + r(), z = -12.5 - r() * 2.2; fir(kb, x, z, 2.6 + r() * 1.8, { layers: 5, seed: 70 + i }); }
  for (let i = 0; i < 26; i++) { const x = -32 + i * 2.6 + r(), z = -21 - r() * 3; fir(kb, x, z, 3 + r() * 2.2, { layers: 4, seed: 100 + i, col: 0x2a4e40 }); }
  // foreground framing: firs on the near side of the street, left and right
  fir(k, -9.4, 7.6, 4.4, { layers: 6, seed: 5 }); fir(k, 12.6, 7.2, 4.0, { layers: 6, seed: 6 }); fir(k, -7.6, 8.9, 2.6, { layers: 4, seed: 7 });
  // the ground: one big sheet of batting, flattened under the lane, banked against walls and kerbs
  ground(k, sk);
}
function clockTower(k, x, z) {
  const y0 = groundHeight(x, z) - 0.05, B = M([x, y0, z]);
  k.cut(rect(-1.1, 0, 1.1, 9.5), null, B, 0xd9c6a2, { batch: 'woven', t: 0.08, amp: 0.02 });
  for (const s of [1, -1]) k.cut(rect(0, 0, 2.2, 9.5), null, B.clone().multiply(M([s * 1.1, 0, s > 0 ? 0 : -2.2], [0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0])), 0xd9c6a2, { batch: 'woven', t: 0.08, amp: 0.02 });
  const spire = new THREE.ConeGeometry(1.7, 3.2, 4, 1); spire.rotateY(Math.PI / 4);
  k.solid(spire, B.clone().multiply(M([0, 9.5 + 1.6, -1.1])), 0x4d4a68, { smooth: false });
  k.lump(0.8, 0.25, 0.8, B.clone().multiply(M([0, 9.9, -1.1])), C.white, { batch: 'batt', detail: 2, amp: 0.3 });
  const face = B.clone().multiply(M([0, 7.6, 0.09]));
  k.pillow(circle(0, 0, 0.78, 32), 0.08, face, 0xfff0cf, { batch: 'glow', rings: 3, flat: 4, step: 0.12, amp: 0 });
  k.cut(circle(0, 0, 0.92, 32), [circle(0, 0, 0.8, 32)], face.clone().multiply(M([0, 0, -0.02])), C.card, { batch: 'card', t: 0.04, amp: 0 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; k.S.addLocal(face, [Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.085], [Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.085], 0x2c2832, 0.025); }
  k.S.addLocal(face, [0, 0, 0.09], [0.0, 0.45, 0.09], 0x2c2832, 0.03); k.S.addLocal(face, [0, 0, 0.09], [0.32, -0.1, 0.09], 0x2c2832, 0.03);
  for (let f = 0; f < 3; f++) k.cut(roundRect(-0.25, 1.2 + f * 1.8, 0.25, 1.9 + f * 1.8, 0.04), null, B.clone().multiply(M([0, 0, 0.08])), 0xffc27a, { batch: 'glow', t: 0.012, amp: 0.004, bevel: 0.004 });
}
function ground(k, sk) {
  const x0 = -36, x1 = 38, z0 = -44, z1 = 22, res = 0.5, nx = Math.round((x1 - x0) / res), nz = Math.round((z1 - z0) / res), pos = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * res, z = z0 + j * res; pos.push(x, groundHeight(x, z) - 0.008, z); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  sk.ground = g;
  // drifts against the house fronts, the kerbs and the fence: soft batting mounds
  const r = rng(5);
  for (let x = LANE.x0 + 0.5; x < LANE.x1; x += 0.9 + r() * 0.8) {
    if (x > -1.2 && x < 1.2) continue;
    k.lump(0.45 + r() * 0.3, 0.07 + r() * 0.06, 0.18, M([x, 0.0, 0.15 + r() * 0.1]), C.white, { batch: 'batt', detail: 2, amp: 0.3, freq: 1.8 });
    k.lump(0.5 + r() * 0.4, 0.06 + r() * 0.05, 0.16, M([x + 0.4, 0.02, LANE.road1 + 0.42]), C.white, { batch: 'batt', detail: 2, amp: 0.3, freq: 1.8 });
    k.lump(0.4 + r() * 0.3, 0.05 + r() * 0.04, 0.13, M([x + 0.2, 0.02, LANE.walk + 0.36]), C.white, { batch: 'batt', detail: 1, amp: 0.3, freq: 1.8 });
  }
}
