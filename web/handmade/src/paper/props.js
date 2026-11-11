// Experiment A — paper-cut storybook: tree, lamp, presents, street, snow, backdrop, door.
import * as THREE from 'three';
import { prim, rect, roundRect, circle, ellipse, star, M, basis, V, TAU, rng } from '../kit.js';
import { T, C, wreath, holly } from './build.js';
import { TREE, LAMP, GIFTS, STREET, SHOP, DOOR } from '../layout.js';

// ------------------------------------------------------------------ the Christmas tree: slotted, gently cupped fins
/** half-silhouette of a fir in a fin's plane (x = out from the trunk, y = up), tiers with drooping tips */
function finOutline(h, R, tiers, r, droop = 0.14) {
  const pts = [[0, 0.5]], ys = [];
  for (let i = 0; i < tiers; i++) ys.push(0.5 + (h - 0.5) * (i / tiers) ** 0.92);
  for (let i = 0; i < tiers; i++) {
    const yb = ys[i], yt = i + 1 < tiers ? ys[i + 1] : h, f = 1 - i / tiers, rt = R * f * (0.95 + 0.1 * r()), ri = R * (1 - (i + 0.75) / tiers) * 0.55;
    pts.push([ri * 1.15, yb + 0.02], [rt * 0.82, yb - droop * f * 0.3], [rt, yb - droop * f], [rt * 0.88, yb + (yt - yb) * 0.18]);
    pts.push([ri, yt - (yt - yb) * 0.05]);
  }
  pts.push([0.03, h + 0.02], [0, h + 0.02]);
  return pts;
}
export function tree(k, sk) {
  const { x, z, h } = TREE, base = M([x, 0, z]), R = 1.25, fins = 10;
  // tub: a folded box of red card with a gilt band, and a scalloped paper skirt underneath
  k.cardBox(0.72, 0.45, 0.72, base, C.red, { amp: 0.002 });
  k.cut(rect(-0.37, 0.3, 0.37, 0.37), null, base.clone().multiply(M([0, 0, 0.36 + 0.004])), C.gold, { batch: 'foil', amp: 0.001 });
  const skirt = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, rr = 1.05 + (i % 2 ? 0.0 : 0.08); skirt.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  k.cut(skirt, [circle(0, 0, 0.3, 18)], base.clone().multiply(M([0, 0.012, 0], [-Math.PI / 2, 0, 0])), 0xe8dcc0, { amp: 0.01 });
  // trunk: a folded triangular tube
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; k.cut(rect(-0.08, 0.4, 0.08, 0.95), null, base.clone().multiply(M([Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045], [0, -a + Math.PI / 2, 0])), C.wood, { amp: 0.002 }); }
  const lightPts = [];
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * TAU + 0.15, big = i % 2 === 0;
    const out = finOutline(h, big ? R : R * 0.86, big ? 7 : 6, k.r, 0.16);
    const P = base.clone().multiply(M([0, big ? 0.35 : 0.55, 0], [0, -a, 0]));
    // each fin cups slightly (paper sags between the slots), and leans out a touch
    k.cut(out.map(([px, py]) => [px, (big ? py : py * 0.92)]), null, P.clone().multiply(M([0, 0, -T / 2], [0, 0, 0])), big ? C.holly : 0x3b7d4d, { amp: 0.004, wave: 0.25, curl: [0.06, 0] });
    // snow along the upper edge of each tier tip: a white scrap glued on both faces
    const tiersN = big ? 7 : 6;
    for (let t = 0; t < tiersN; t += 1) {
      const f = 1 - t / tiersN, yb = 0.5 + (h - 0.5) * (t / tiersN) ** 0.92, rt = (big ? R : R * 0.86) * f;
      if (k.r() < 0.35) continue;
      for (const s of [1, -1]) k.cut([[rt * 0.45, yb + 0.08], [rt * 0.9, yb - 0.02], [rt * 1.0, yb - 0.1 * f], [rt * 0.7, yb + 0.02], [rt * 0.45, yb + 0.12]],
        null, P.clone().multiply(M([0, 0, s > 0 ? T / 2 + 0.004 : -T / 2 - 0.004 - T * 0.6])), C.white, { t: T * 0.6, tear: 0.006, tearWave: 0.03, amp: 0.004 });
      // ornament: a punched disc hanging from the tip, and a light bead
      if (k.r() < 0.55) {
        const o = new THREE.Vector3(rt * 0.95, yb - 0.1 * f - 0.12, 0).applyMatrix4(P);
        const face = M([o.x, o.y, o.z], [0, -a + Math.PI / 2, 0]);
        const col = k.r() < 0.33 ? C.berry : k.r() < 0.5 ? 0x3d6fb0 : C.gold;
        k.cut(circle(0, 0, 0.065, 16), null, face, col, { batch: col === C.gold ? 'foil' : 'card', amp: 0.002, centre: true });
        k.cut(circle(0, 0, 0.035, 12), null, face.clone().multiply(M([0, 0, T * 0.6])), col === C.gold ? C.berry : C.gold, { batch: 'foil', amp: 0.001, centre: true, t: T * 0.5 });
        k.cut(circle(0, 0, 0.035, 12), null, face.clone().multiply(M([0, 0, -T * 0.6])), col === C.gold ? C.berry : C.gold, { batch: 'foil', amp: 0.001, centre: true, t: T * 0.5 });
        k.cut(rect(-0.005, 0.06, 0.005, 0.14), null, face, C.ink, { t: 0.006, amp: 0, centre: true });
      } else lightPts.push(new THREE.Vector3(rt * 0.8, yb + 0.02, 0).applyMatrix4(P));
    }
  }
  // paper-chain garland: alternating links (open bands of card) on a spiral
  const ring = prim(new THREE.CylinderGeometry(0.045, 0.045, 0.028, 12, 1, true), false);
  const links = []; let s = 0;
  for (let u = 0.05; u < 0.92; u += 0.0045) {
    const y = 0.75 + u * (h - 0.9), rr = (R * (1 - (y - 0.4) / (h - 0.4)) * 0.92 + 0.12), a = u * TAU * 3.2;
    const p = V(x + Math.cos(a) * rr, y + 0.06 * Math.sin(u * 40.0), z + Math.sin(a) * rr);
    if (links.length && links[links.length - 1].distanceTo(p) < 0.075) continue;
    links.push(p);
    const tang = V(-Math.sin(a), 0.04, Math.cos(a)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), tang).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), (s++ % 2) * Math.PI / 2));
    const m4 = new THREE.Matrix4().compose(p, q, V(1, 1, 1)).multiply(M([0, 0, 0], [0, 0, Math.PI / 2]));
    k.B.card.add(ring, m4, [C.berry, C.gold, C.cream][s % 3], { vary: 0.03 });
  }
  // the lights: little glowing beads (their own material so they can twinkle)
  const bead = prim(new THREE.IcosahedronGeometry(0.045, 0), false);
  for (const p of lightPts.concat(links.filter((_, i) => i % 7 === 3).map((p) => p.clone().add(V(0, -0.05, 0))))) sk.lights.add(bead, M([p.x, p.y, p.z]), k.r() < 0.5 ? 0xffd28a : (k.r() < 0.5 ? 0xff9a6a : 0xfff0c0), { vary: 0.05, extra: k.r() });
  // folded star: ten facets each side, creased along the points (flat-shaded so the folds catch the light)
  sk.star = foldedStar(0.3, 0.13, 0.07);
  sk.starMatrix = M([x, h + 0.25, z], [0, 0.3, 0]);
  return { top: V(x, h + 0.25, z) };
}
function foldedStar(r0, r1, dz) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? r1 : r0; pts.push(V(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  const pos = [];
  for (const s of [1, -1]) for (let i = 0; i < 10; i++) { const a = pts[i], b = pts[(i + 1) % 10], c = V(0, 0, s * dz); if (s > 0) pos.push(c, a, b); else pos.push(c, b, a); }
  const g = new THREE.BufferGeometry().setFromPoints(pos); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ the street lamp: black card, filigree, a vellum lantern
export function lamp(k, sk) {
  const { x, z, h } = LAMP, base = M([x, 0, z]);
  k.cardBox(0.52, 0.14, 0.52, base, C.ink, { amp: 0.002 });
  k.cardBox(0.38, 0.22, 0.38, base.clone().multiply(M([0, 0.14, 0])), 0x33292e, { amp: 0.002 });
  k.cardBox(0.2, 0.32, 0.2, base.clone().multiply(M([0, 0.36, 0])), C.ink, { amp: 0.002 });
  k.cardBox(0.12, h - 0.9, 0.12, base.clone().multiply(M([0, 0.6, 0])), C.ink, { amp: 0.001, top: false });
  for (const f of [0, 1, 2, 3]) {    // flutes: thin strips on each face
    const P = base.clone().multiply(M([0, 0, 0], [0, f * Math.PI / 2, 0])).multiply(M([0, 0, 0.06]));
    k.cut(rect(-0.018, 0.95, 0.018, h - 0.6), null, P, 0x3a3036, { t: T * 0.6, amp: 0.001 });
  }
  for (const y of [0.92, 1.85, h - 0.42]) k.cardBox(0.2, 0.07, 0.2, base.clone().multiply(M([0, y, 0])), C.ink, { amp: 0.001 });
  // filigree brackets: two crossed slotted cut-outs with punched holes
  for (const ry of [0, Math.PI / 2]) {
    const P = base.clone().multiply(M([0, h - 0.52, 0], [0, ry, 0]));
    for (const s of [1, -1]) {
      const curl = [];
      for (let i = 0; i <= 20; i++) { const t = i / 20, a = Math.PI * 1.1 * t; curl.push([s * (0.06 + 0.2 * Math.sin(a * 0.9)), -0.3 + 0.32 * t - 0.06 * Math.sin(a)]); }
      for (let i = 20; i >= 0; i--) { const t = i / 20, a = Math.PI * 1.1 * t; curl.push([s * (0.06 + 0.13 * Math.sin(a * 0.9)), -0.3 + 0.34 * t - 0.02 * Math.sin(a)]); }
      k.cut(curl, null, P.clone().multiply(M([0, 0, -T / 2])), C.ink, { amp: 0.002 });
      k.cut(circle(s * 0.2, -0.04, 0.035, 10), [circle(s * 0.2, -0.04, 0.015, 8)], P.clone().multiply(M([0, 0, -T / 2])), C.ink, { amp: 0.001 });
    }
  }
  // lantern: four framed vellum panes, a folded pyramid roof, a finial
  const ly = h - 0.45, lw = 0.42, lh = 0.55, L = base.clone().multiply(M([0, ly, 0]));
  k.cardBox(lw + 0.1, 0.06, lw + 0.1, L, C.ink, { amp: 0.001 });
  for (let f = 0; f < 4; f++) {
    const P = L.clone().multiply(M([0, 0, 0], [0, f * Math.PI / 2, 0]));
    k.cut(rect(-lw / 2, 0.06, lw / 2, 0.06 + lh), [rect(-lw / 2 + 0.05, 0.11, -0.012, 0.06 + lh - 0.05), rect(0.012, 0.11, lw / 2 - 0.05, 0.06 + lh - 0.05)], P.clone().multiply(M([0, 0, lw / 2 - T])), C.ink, { amp: 0.001, hamp: 0.001 });
    sk.lamp.add(prim(new THREE.PlaneGeometry(lw - 0.06, lh - 0.06)), P.clone().multiply(M([0, 0.06 + lh / 2, lw / 2 - T - 0.03])), 0xffd8a0, { vary: 0.02 });
  }
  const apex = V(0, 0.06 + lh + 0.36, 0), eaves = 0.32;
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2, p0 = V(-eaves, 0.06 + lh, eaves).applyAxisAngle(V(0, 1, 0), a), p1 = V(eaves, 0.06 + lh, eaves).applyAxisAngle(V(0, 1, 0), a);
    const u = p1.clone().sub(p0), mid = p0.clone().add(p1).multiplyScalar(0.5), v = apex.clone().sub(mid);
    const P = L.clone().multiply(basis(p0, u, v));
    k.cut([[0, 0], [u.length(), 0], [u.length() / 2, v.length()]], null, P, C.ink, { amp: 0.001 });
    k.cut([[0.04, 0.05], [u.length() - 0.04, 0.05], [u.length() * 0.62, v.length() * 0.62], [u.length() * 0.3, v.length() * 0.75]], null, P.clone().multiply(M([0, 0, T + 0.004])), C.white, { tear: 0.006, tearWave: 0.03, amp: 0.004, t: T * 0.7 });
  }
  k.cut(circle(0, 0, 0.06, 10), null, L.clone().multiply(M([0, 0.06 + lh + 0.42, 0])), C.gold, { batch: 'foil', centre: true, amp: 0 });
  k.cut(circle(0, 0, 0.06, 10), null, L.clone().multiply(M([0, 0.06 + lh + 0.42, 0], [0, Math.PI / 2, 0])), C.gold, { batch: 'foil', centre: true, amp: 0 });
  wreath(k, base.clone().multiply(M([0, 1.45, 0.06 + 0.02])));
  return { light: V(x, ly + 0.06 + lh / 2, z), hit: { x, z, r: 0.45, y0: 0, y1: h + 0.3 } };
}

// ------------------------------------------------------------------ presents: folded card boxes, ribbon strips, looped bows
export function presents(k) {
  for (const g of GIFTS) {
    const [w, h, d] = g.s, Pm = M([g.p[0], 0, g.p[1]], [0, g.r, 0]);
    k.cardBox(w, h, d, Pm, g.c, { amp: 0.002 });
    const rw = 0.06, o = 0.004;
    for (const ax of [0, 1]) {   // two ribbons crossing: down the sides and over the lid
      const P = ax ? Pm.clone().multiply(M([0, 0, 0], [0, Math.PI / 2, 0])) : Pm;
      const L = ax ? w : d, Wd = ax ? d : w;
      k.cut(rect(-rw / 2, 0, rw / 2, h), null, P.clone().multiply(M([0, 0, L / 2 + o])), g.c2, { t: T * 0.5, amp: 0.001 });
      k.cut(rect(-rw / 2, 0, rw / 2, h), null, P.clone().multiply(M([0, 0, -L / 2 - o - T * 0.5])), g.c2, { t: T * 0.5, amp: 0.001 });
      k.cut(rect(-rw / 2, -L / 2 - o, rw / 2, L / 2 + o), null, P.clone().multiply(M([0, h + o, 0], [-Math.PI / 2, 0, 0])), g.c2, { t: T * 0.5, amp: 0.001 });
      void Wd;
    }
    // bow: two loops of curled ribbon (open bands) and two notched tails
    const loop = prim(new THREE.CylinderGeometry(0.07, 0.07, rw * 0.9, 14, 1, true, 0, TAU * 0.92), false);
    for (const s of [1, -1]) {
      k.B.card.add(loop, Pm.clone().multiply(M([s * 0.07, h + 0.06, 0], [Math.PI / 2, 0, s * 0.5])).multiply(M([0, 0, 0], [0, 0, Math.PI / 2])), g.c2, { vary: 0.02 });
      k.cut([[0, 0], [rw / 2, 0], [rw / 2 + 0.03, 0.18], [0.01, 0.15], [-0.02, 0.19]], null, Pm.clone().multiply(M([s * 0.02, h + 0.012, 0.01], [-Math.PI / 2, 0, s * 0.6 + Math.PI])), g.c2, { t: T * 0.5, amp: 0.001 });
    }
    k.cardBox(0.06, 0.05, 0.06, Pm.clone().multiply(M([0, h, 0])), g.c2, { amp: 0 });
  }
}

// ------------------------------------------------------------------ the street: a layered board, pavement, cobbles, snow drifts
export function street(k) {
  const { x0, x1, zWalk, z1, zBoard, zBack } = STREET;
  // the base: four laminated boards, each a little uneven, so the edge reads as stacked card
  const layers = [0xcab48e, 0xe6d8bb, 0xbaa27a, 0xd8c8a6];
  for (let i = 0; i < 4; i++) {
    const th = 0.07, y = -0.3 + i * th, inset = i * 0.02;
    k.cut(rect(x0 + inset, zBack + inset, x1 - inset, zBoard - inset), null, M([0, y + th, 0], [Math.PI / 2, 0, 0]), layers[i], { t: th, amp: 0.012, wave: 0.6, vary: 0.02 });
  }
  // snow sheet over the whole board (the base layer everything stands on)
  k.cut(rect(x0 + 0.06, zBack + 0.06, x1 - 0.06, zBoard - 0.06), null, M([0, 0.001, 0], [Math.PI / 2, 0, 0]), 0xf6f2ea, { t: T * 0.6, tear: 0.02, tearWave: 0.08, amp: 0.02, wave: 0.8 });
  // road: grey card with torn edges, then individually cut cobbles in two layers
  const roadZ0 = zWalk + 0.3, roadZ1 = z1;
  k.cut(rect(x0 + 0.2, -roadZ1, x1 - 0.2, -roadZ0), null, M([0, 0.02 + T, 0], [-Math.PI / 2, 0, 0]), 0x6d6670, { tear: 0.03, tearWave: 0.1, amp: 0.02 });
  const cob = [0x8a8390, 0x9b95a0, 0x7a7480, 0xa59aa0, 0x8e8478];
  for (let zz = roadZ0 + 0.18; zz < roadZ1 - 0.12; zz += 0.27) {
    const row = Math.round(zz / 0.27);
    for (let xx = x0 + 0.4 + (row % 2) * 0.17; xx < x1 - 0.4; xx += 0.33 + k.r() * 0.05) {
      const w = 0.26 + k.r() * 0.06, d = 0.2 + k.r() * 0.04, rr = 0.06 + k.r() * 0.04, ang = (k.r() - 0.5) * 0.25;
      const P = M([xx, 0.02 + T * 2, zz], [-Math.PI / 2, 0, ang]);
      k.cut(roundRect(-w / 2, -d / 2, w / 2, d / 2, rr, 3), null, P, cob[(k.r() * cob.length) | 0], { amp: 0.012, wave: 0.12, vary: 0.07 });
      if (k.r() < 0.28) k.cut(roundRect(-w / 2 + 0.05, -d / 2 + 0.04, w / 2 - 0.05, d / 2 - 0.04, rr * 0.8, 3), null, P.clone().multiply(M([0, 0, T])), 0xb3acb5, { amp: 0.01, wave: 0.1, vary: 0.05 });
    }
  }
  // pavement slabs in front of the buildings and a kerb strip folded along the road edge
  for (let xx = x0 + 0.5; xx < x1 - 0.5; xx += 0.72) for (let zz = 0.15; zz < zWalk; zz += 0.62) {
    if (xx > -1.2 && xx < 1.0 && zz < 0.8) continue;   // the shop step sits there
    k.cut(roundRect(-0.33, -0.28, 0.33, 0.28, 0.04), null, M([xx + 0.32, 0.02 + T, zz + 0.29], [-Math.PI / 2, 0, (k.r() - 0.5) * 0.05]), k.r() < 0.5 ? 0xb9aea0 : 0xa99f94, { amp: 0.006, wave: 0.2, vary: 0.05 });
  }
  k.cut(rect(x0 + 0.2, 0, x1 - 0.2, 0.09), null, M([0, 0.02, zWalk + 0.27]), 0x8d8590, { amp: 0.004, wave: 0.5 });
  k.cut(rect(x0 + 0.2, -0.14, x1 - 0.2, 0), null, M([0, 0.11, zWalk + 0.27], [-Math.PI / 2, 0, 0]), 0x9d95a0, { amp: 0.004, wave: 0.5 });
  // snow drifts: stacked torn scraps (each layer on a spacer) along the walls, kerb, board edges and the lamp/tree bases
  const drift = (cx, cz, w, d, layers = 3, rot = 0) => {
    for (let i = 0; i < layers; i++) {
      const s = 1 - i * 0.26, pts = [], ph = k.r() * 6, ph2 = k.r() * 6;
      for (let q = 0; q < 26; q++) { const a = (q / 26) * TAU; pts.push([Math.cos(a) * w * s * (1 + 0.16 * Math.sin(a * 2 + ph) + 0.08 * Math.sin(a * 5 + ph2)), Math.sin(a) * d * s * (1 + 0.22 * Math.sin(a * 3 + ph2))]); }
      k.cut(pts, null, M([cx + (k.r() - 0.5) * w * 0.5, 0.03 + T * (1.2 + i * 1.6) + i * 0.025, cz + (k.r() - 0.5) * d * 0.5], [-Math.PI / 2, 0, rot + (k.r() - 0.5) * 0.4]),
        i % 2 ? 0xf8f5ee : 0xfdfbf6, { tear: 0.03, tearWave: 0.07, amp: 0.05, wave: 0.6, vary: 0.01, curl: [i ? -0.03 : 0, 0] });
    }
  };
  for (let xx = x0 + 0.8; xx < x1 - 0.5; xx += 1.3 + k.r() * 0.8) { drift(xx, zWalk + 0.45 + k.r() * 0.15, 0.6 + k.r() * 0.4, 0.22, 2); drift(xx + 0.4, z1 + 0.25, 0.8 + k.r() * 0.5, 0.35, 3); }
  for (let xx = x0 + 0.5; xx < x1; xx += 1.1 + k.r() * 0.7) drift(xx, zBoard - 0.5, 0.8 + k.r() * 0.5, 0.45, 3);
  for (const [cx, cz, w, d] of [[-3.2, 0.25, 0.8, 0.3], [2.1, 0.3, 0.45, 0.25], [-2.3, 0.3, 0.5, 0.25], [3.2, -0.2, 0.6, 0.4], [4.4, -0.05, 0.6, 0.3], [8.4, -0.05, 0.6, 0.35],
    [LAMP.x, LAMP.z, 0.55, 0.45], [TREE.x - 0.9, TREE.z + 0.7, 0.6, 0.4], [-6.5, 0.7, 1.2, 0.7], [-8.4, -1.5, 1.3, 0.8], [10.4, 0.4, 1.4, 0.7], [11.0, -2.5, 1.2, 0.9]]) drift(cx, cz, w, d, 3);
  // behind the houses: a softer drift line
  for (let xx = x0 + 1; xx < x1 - 1; xx += 1.6) drift(xx, -5.7 - k.r() * 0.6, 1.0, 0.6, 2);
}

// ------------------------------------------------------------------ theatre-flat backdrop: layered hills, a village, firs, the moon
export function backdrop(k, sk) {
  const r = rng(91);
  const hill = (z, y0, amp, freq, phase, col, snow, rise = 0) => {
    const pts = [[-46, -1], [50, -1]];
    for (let i = 120; i >= 0; i--) { const x = -46 + (i / 120) * 96; pts.push([x, y0 + rise * (x / 28) + amp * (0.55 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7) + 0.15 * Math.sin(x * freq * 5.1))]); }
    k.cut(pts, null, M([0, 0, z]), col, { amp: 0.05, wave: 1.2, vary: 0.02 });
    if (snow) {   // a white layer cut to follow the top of the hill, standing a spacer in front
      const top = pts.slice(2), cap = top.map(([x, y]) => [x, y + 0.02]), under = top.slice().reverse().map(([x, y]) => [x, y - 0.14 - 0.16 * Math.abs(Math.sin(x * 2.1 + phase)) - 0.07 * Math.sin(x * 6.3)]);
      k.cut([...cap, ...under], null, M([0, 0, z + 0.08]), C.white, { tear: 0.04, tearWave: 0.12, amp: 0.03, vary: 0.01 });
    }
    return (x) => y0 + rise * (x / 28) + amp * (0.55 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7) + 0.15 * Math.sin(x * freq * 5.1));
  };
  hill(-24, 9.5, 2.4, 0.11, 1.4, 0x4a5a8c, true, 1.6);
  hill(-20, 7.0, 1.8, 0.16, 0.4, 0x3a4878, true, 1.0);
  const mid = hill(-15.5, 4.6, 1.3, 0.22, 2.1, 0x2d3a66, true, -0.4);
  // a hillside village: little card houses (front flats) with glowing cut windows
  for (let i = 0; i < 16; i++) {
    const x = -26 + i * 3.6 + r() * 1.4, y = mid(x) - 0.7, w = 0.9 + r() * 0.7, h = 0.8 + r() * 0.6, ro = 0.5 + r() * 0.4;
    const z = -15.2 + r() * 0.2, col = r() < 0.5 ? 0x5a4c6e : 0x4a5a7a;
    k.cut([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + ro], [-w / 2, h]], [rect(-w / 4 - 0.1, h * 0.35, -w / 4 + 0.1, h * 0.65), rect(w / 4 - 0.1, h * 0.35, w / 4 + 0.1, h * 0.65)], M([x, y, z]), col, { amp: 0.01 });
    k.cut(rect(-w / 2, h * 0.2, w / 2, h * 0.8), null, M([x, y, z - 0.05]), 0xffb866, { batch: 'vellum', amp: 0.005 });
    k.cut([[-w / 2 - 0.08, h - 0.03], [0, h + ro + 0.06], [w / 2 + 0.08, h - 0.03], [w / 2 - 0.05, h + 0.1], [0, h + ro - 0.08], [-w / 2 + 0.05, h + 0.1]], null, M([x, y, z + 0.04]), C.white, { amp: 0.008 });
  }
  const near = hill(-10.5, 1.9, 0.9, 0.27, 4.0, 0x223058, true, 0.2);
  // fir silhouettes standing on the near hill (two-layer: dark tree, white snow strokes)
  for (let i = 0; i < 34; i++) {
    const x = -30 + i * 1.95 + r() * 1.2, h = 1.4 + r() * 1.6, y = near(x) - 0.5, w = h * 0.36, z = -10.2 + r() * 0.3;
    const out = []; const n = 5;
    for (let j = 0; j < n; j++) { const t = j / n, yb = h * t, ww = w * (1 - t); out.push([ww, yb + 0.25], [ww * 0.45, yb + 0.25 + h / n * 0.3]); }
    out.push([0, h + 0.25]);
    const full = [[0.06, 0], ...out, ...out.slice(0, -1).reverse().map(([a, b]) => [-a, b]), [-0.06, 0]];
    k.cut(full, null, M([x, y, z]), r() < 0.5 ? 0x1d3a3a : 0x22424a, { amp: 0.01 });
    for (let j = 0; j < n; j++) { const t = j / n, yb = h * t, ww = w * (1 - t); k.cut([[-ww * 0.8, yb + 0.25], [ww * 0.8, yb + 0.25], [ww * 0.3, yb + 0.35], [-ww * 0.3, yb + 0.33]], null, M([x, y, z + 0.04]), C.white, { amp: 0.005, t: T * 0.6 }); }
  }
  // the sky: a curved board, painted with a soft gradient (own material), stars as tiny punched vellum dots
  const sky = new THREE.CylinderGeometry(40, 40, 34, 72, 8, true, Math.PI * 0.5, Math.PI);
  sk.sky = { geo: sky, matrix: M([1, 12, 8]) };
  for (let i = 0; i < 90; i++) {
    const a = Math.PI * 0.6 + r() * Math.PI * 0.8, y = 8 + r() * 18, rr = 39.4;
    const p = V(1 + Math.sin(a) * rr, y, 8 + Math.cos(a) * rr), s = 0.04 + r() * r() * 0.1;
    sk.stars.add(prim(new THREE.CircleGeometry(s, 5)), new THREE.Matrix4().lookAt(p, V(1, y, 8), V(0, 1, 0)).setPosition(p), 0xfff4d8, { vary: 0.1, extra: r() });
  }
  // the moon: a vellum disc with two torn cloud scraps across it
  const mp = V(-9, 15.5, -19.5);
  k.cut(circle(0, 0, 1.5, 48), null, M([mp.x, mp.y, mp.z]), 0xfff1cf, { batch: 'vellum', amp: 0.01, extra: 1 });
  for (const [dx, dy, w] of [[-0.6, -0.5, 2.0], [1.0, 0.4, 1.6]]) k.cut(ellipse(0, 0, w, 0.28, 24), null, M([mp.x + dx, mp.y + dy, mp.z + 0.15]), 0x56608e, { tear: 0.04, tearWave: 0.1, amp: 0.05 });
}

// ------------------------------------------------------------------ the shop door: its own little kit, built in hinge space
export function door(k) {
  const w = DOOR.w - 0.02, h = DOOR.h - 0.02, glass = rect(0.16, 1.45, w - 0.16, 1.98);
  k.cut(rect(0, 0, w, h), [glass], M([0, 0, -T / 2]), C.doorG, { amp: 0.002 });
  for (const s of [1, -1]) {   // raised panels on both faces, two layers each
    const z = s > 0 ? T / 2 : -T / 2 - T;
    for (const [px, py, pw, ph] of [[0.12, 0.18, 0.36, 0.5], [w - 0.48, 0.18, 0.36, 0.5], [0.12, 0.8, 0.36, 0.5], [w - 0.48, 0.8, 0.36, 0.5]]) {
      k.cut(rect(px, py, px + pw, py + ph), null, M([0, 0, z]), 0x2f5a45, { amp: 0.002 });
      k.cut(rect(px + 0.05, py + 0.05, px + pw - 0.05, py + ph - 0.05), null, M([0, 0, z + s * T]), 0x4a8063, { amp: 0.002 });
    }
    k.cut(rect(0.1, 1.38, w - 0.1, 2.05), [glass], M([0, 0, z]), 0x2f5a45, { amp: 0.002 });
  }
  k.cut(rect(0.13, 1.42, w - 0.13, 2.01), null, M([0, 0, -0.005]), 0xffd28a, { batch: 'vellum', t: 0.01, amp: 0.002 });
  k.cut(rect(w / 2 - 0.015, 1.45, w / 2 + 0.015, 1.98), null, M([0, 0, T / 2 + 0.002]), C.doorG, { amp: 0, t: T * 0.6 });
  for (const [r0, z] of [[0.06, T / 2], [0.045, T * 1.5], [0.03, T * 2.5]]) k.cut(circle(w - 0.14, 1.05, r0, 14), null, M([0, 0, z]), C.gold, { batch: 'foil', amp: 0 });
  // a little card sign hanging in the glass
  k.cut(roundRect(w / 2 - 0.2, 1.52, w / 2 + 0.2, 1.72, 0.03), null, M([0, 0, T / 2 + 0.03]), C.cream, { amp: 0.002 });
  k.cut(rect(w / 2 - 0.13, 1.6, w / 2 + 0.13, 1.64), null, M([0, 0, T / 2 + 0.03 + T]), C.red, { amp: 0, t: 0.01 });
  holly(k, M([w / 2, 2.1, T / 2 + 0.02]), 5, 0.8);
}
