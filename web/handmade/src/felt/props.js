// Experiment B — felt props: needle-felted tree, felt lamp, fabric-wrapped presents, felt-pebble street,
// carded-wool snow, a quilted backdrop and the shop door.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rect, roundRect, circle, ellipse, star, M, V, TAU, rng, prim } from '../kit.js';
import { FT, fbm3js, firGeo } from './kit.js';
import { C, holly, wreath } from './build.js';
import { TREE, LAMP, GIFTS, STREET, DOOR } from '../layout.js';

// ------------------------------------------------------------------ the needle-felted tree
export function tree(k, sk) {
  const { x, z, h } = TREE, base = M([x, 0, z]);
  // a felt-wrapped tub with a stitched band
  k.solid(new THREE.CylinderGeometry(0.4, 0.34, 0.5, 20), base.clone().multiply(M([0, 0.25, 0])), C.red, { fuzz: 1 });
  k.solid(new THREE.CylinderGeometry(0.41, 0.4, 0.08, 20), base.clone().multiply(M([0, 0.4, 0])), C.gold, { fuzz: 0.8 });
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; k.S.add(V(x + Math.cos(a) * 0.42, 0.37, z + Math.sin(a) * 0.42), V(x + Math.cos(a + 0.16) * 0.42, 0.43, z + Math.sin(a + 0.16) * 0.42), C.thread, 0.008); }
  k.solid(new THREE.CylinderGeometry(0.1, 0.12, 0.5, 10), base.clone().multiply(M([0, 0.65, 0])), C.wood, { fuzz: 1 });
  // the tree: one firm needle-felted cone with drooping tiers, two greens felted in patches, wool snow on the tiers
  const tiers = 6, R = 1.25, y0 = 0.82, TH = h - 0.7;
  k.B.felt.add(firGeo(TH, R, { tiers, seed: 5, lumpAmp: 0.07 }), base.clone().multiply(M([0, y0, 0])), 0x245f3b, { vary: 0, extra: 2.4 });
  const tierInfo = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, rr = R * (1 - t) ** 0.95, y = y0 + t * TH + 0.02;
    tierInfo.push({ y, rr });
    for (let j = 0; j < 4 + (tiers - i); j++) {       // tufts of carded wool resting on each tier's shelf
      const a = (j / (4 + tiers - i)) * TAU + i * 0.9 + k.r() * 0.4, d = rr * (0.62 + 0.25 * k.r());
      k.lump(0.13 + 0.07 * k.r(), 0.05, 0.11, base.clone().multiply(M([Math.cos(a) * d, y + TH / tiers * 0.22 - 0.02, Math.sin(a) * d], [0, -a, 0])), C.white, { batch: 'wool', fuzz: 3, detail: 2, amp: 0.3, freq: 2.6 });
    }
  }
  // felt-ball ornaments, a yarn garland, glowing felt-ball lights
  const ball = new THREE.SphereGeometry(1, 14, 10);
  for (let i = 0; i < 26; i++) {
    const ti = tierInfo[(k.r() * (tiers - 1)) | 0], a = k.r() * TAU, d = ti.rr * 0.92;
    const p = V(x + Math.cos(a) * d, ti.y - 0.02 - k.r() * 0.08, z + Math.sin(a) * d), s = 0.065 + k.r() * 0.025;
    const col = [C.berry, C.gold, 0x3d6fb0, C.cream, 0xd06aa0][(k.r() * 5) | 0];
    k.B.felt.add(ball, M([p.x, p.y, p.z], [0, 0, 0], s), col, { vary: 0.05, extra: 1.6 });
    k.S.add(V(p.x - s * 0.7, p.y + s * 0.2, p.z), V(p.x + s * 0.7, p.y + s * 0.2, p.z), C.thread, 0.006);
  }
  const yarn = [];
  for (let u = 0; u <= 1; u += 0.004) { const y = 0.95 + u * (h - 1.15), t = (y - 0.82) / (h - 0.7), rr = R * Math.pow(1 - t, 0.95) * 0.86 + 0.03, a = u * TAU * 3.0; yarn.push(V(x + Math.cos(a) * rr, y - 0.08 * Math.sin(a * 5) * 0, z + Math.sin(a) * rr)); }
  const curve = new THREE.CatmullRomCurve3(yarn);
  k.B.felt.add(new THREE.TubeGeometry(curve, 400, 0.028, 6, false), null, 0xc93a3a, { vary: 0.02, extra: 1.2 });
  for (let i = 0; i < 46; i++) { const p = curve.getPointAt((i + 0.5) / 46); sk.lights.add(new THREE.SphereGeometry(0.045, 8, 6), M([p.x, p.y - 0.05, p.z]), k.r() < 0.5 ? 0xffd28a : (k.r() < 0.5 ? 0xff9a6a : 0xfff0c0), { vary: 0.05, extra: k.r() }); }
  // the star: a stuffed felt star, blanket-stitched in gold
  const st = star(0, 0, 0.3, 0.13, 5);
  const SP = M([x, 0.82 + (h - 0.7) + 0.16, z]);
  k.pillow(st, 0.06, SP, C.gold, { flat: 2.5, rings: 4, fuzz: 1, step: 0.03 });
  k.S.blanket(SP, st, 0.0, 0xa8762a, { step: 0.05, depth: 0.04, r: 0.006, over: 0.02 });
  return { top: V(x, h + 0.4, z) };
}

// ------------------------------------------------------------------ the felt lamp
export function lamp(k, sk) {
  const { x, z, h } = LAMP, base = M([x, 0, z]), ink = 0x2b2833;
  k.solid(new RoundedBoxGeometry(0.55, 0.16, 0.55, 2, 0.06), base.clone().multiply(M([0, 0.08, 0])), ink, { fuzz: 1 });
  k.solid(new RoundedBoxGeometry(0.38, 0.24, 0.38, 2, 0.06), base.clone().multiply(M([0, 0.28, 0])), 0x3a3540, { fuzz: 1 });
  k.solid(new THREE.CylinderGeometry(0.075, 0.09, h - 0.6, 12), base.clone().multiply(M([0, 0.4 + (h - 0.6) / 2, 0])), ink, { fuzz: 1 });
  // a whipped seam spiralling up the post (felt wrapped round a dowel and oversewn)
  for (let yy = 0.5; yy < h - 0.4; yy += 0.07) { const a = yy * 9.0; k.S.add(V(x + Math.cos(a) * 0.088, yy, z + Math.sin(a) * 0.088), V(x + Math.cos(a + 0.9) * 0.088, yy + 0.05, z + Math.sin(a + 0.9) * 0.088), 0x8a8494, 0.007); }
  for (const yy of [0.95, 1.9]) k.solid(new THREE.TorusGeometry(0.1, 0.03, 8, 18).rotateX(Math.PI / 2), base.clone().multiply(M([0, yy, 0])), C.gold, { fuzz: 0.6 });
  // lantern: a felt box with glowing golden felt windows (stitched panes) under a felt cone roof and a wool snow cap
  const ly = h - 0.45, lw = 0.44, lh = 0.56, L = base.clone().multiply(M([0, ly, 0]));
  k.solid(new RoundedBoxGeometry(lw + 0.1, 0.08, lw + 0.1, 2, 0.03), L.clone().multiply(M([0, 0.04, 0])), ink, { fuzz: 0.8 });
  for (let f = 0; f < 4; f++) {
    const P = L.clone().multiply(M([0, 0, 0], [0, f * Math.PI / 2, 0]));
    k.cut(rect(-lw / 2, 0.08, lw / 2, 0.08 + lh), [roundRect(-lw / 2 + 0.06, 0.14, lw / 2 - 0.06, 0.02 + lh, 0.03)], P.clone().multiply(M([0, 0, lw / 2 - 0.05])), ink, { t: 0.05, fuzz: 0.8, amp: 0.003 });
    sk.lamp.add(prim(new THREE.PlaneGeometry(lw - 0.1, lh - 0.1)), P.clone().multiply(M([0, 0.08 + lh / 2, lw / 2 - 0.06])), 0xffd8a0, { vary: 0.02 });
    k.S.satin(P.clone().multiply(M([0, 0, lw / 2 - 0.055])), [[0, 0.15], [0, lh + 0.01]], 0, ink, { width: 0.03, spacing: 0.012, r: 0.006 });
  }
  k.solid(new THREE.ConeGeometry(0.4, 0.38, 4, 1).rotateY(Math.PI / 4), L.clone().multiply(M([0, 0.08 + lh + 0.19, 0])), ink, { fuzz: 1 });
  k.lump(0.26, 0.12, 0.26, L.clone().multiply(M([0, 0.08 + lh + 0.26, 0])), C.white, { batch: 'wool', fuzz: 3.2, detail: 2, amp: 0.3, freq: 2.4 });
  k.solid(new THREE.SphereGeometry(0.06, 12, 8), L.clone().multiply(M([0, 0.08 + lh + 0.42, 0])), C.gold, { fuzz: 0.5 });
  wreath(k, base.clone().multiply(M([0, 1.45, 0.11])));
  return { light: V(x, ly + 0.08 + lh / 2, z) };
}

// ------------------------------------------------------------------ fabric-wrapped presents with satin ribbon
export function presents(k, sk) {
  GIFTS.forEach((g, i) => {
    const [w, h, d] = g.s, Pm = M([g.p[0], h / 2, g.p[1]], [0, g.r, 0]);
    sk.gifts.push({ geo: new RoundedBoxGeometry(w, h, d, 3, 0.05), matrix: Pm, c1: g.c, c2: g.c2, pattern: i % 2 ? 'tartan' : 'gingham' });
    const rib = g.c2 === 0xf3ead8 ? 0xb8262c : g.c2;
    sk.ribbon.add(new RoundedBoxGeometry(w + 0.012, h + 0.012, 0.07, 2, 0.01), Pm, rib, {});
    sk.ribbon.add(new RoundedBoxGeometry(0.07, h + 0.014, d + 0.014, 2, 0.01), Pm, rib, {});
    for (const s of [-1, 1]) {
      const loop = new THREE.TorusGeometry(0.075, 0.018, 8, 20); loop.scale(1, 0.75, 1.6);
      sk.ribbon.add(loop, Pm.clone().multiply(M([s * 0.08, h / 2 + 0.06, 0], [0, 0, s * 0.55])), rib, {});
      sk.ribbon.add(new RoundedBoxGeometry(0.06, 0.012, 0.16, 1, 0.004), Pm.clone().multiply(M([s * 0.05, h / 2 + 0.01, 0.07], [0.1, s * 0.6, 0])), rib, {});
    }
    sk.ribbon.add(new THREE.SphereGeometry(0.035, 10, 8), Pm.clone().multiply(M([0, h / 2 + 0.04, 0])), rib, {});
  });
}

// ------------------------------------------------------------------ the street: stitched base quilt, felt-pebble cobbles, wool snow
export function street(k) {
  const { x0, x1, zWalk, z1, zBoard, zBack } = STREET;
  // base: three layers of thick felt, blanket-stitched around the top edge
  for (let i = 0; i < 3; i++) {
    const th = 0.1, y = -0.3 + i * th, inset = i * 0.03;
    k.cut(rect(x0 + inset, zBack + inset, x1 - inset, zBoard - inset), null, M([0, y + th, 0], [Math.PI / 2, 0, 0]), [0x6a5a4e, 0x8a7666, 0xe9e3d8][i], { t: th, bevel: 0.035, amp: 0.02, wave: 0.6, rag: 0, fuzz: 0 });
  }
  const top = M([0, 0.001, 0], [-Math.PI / 2, 0, 0]);
  k.S.blanket(top, rect(x0 + 0.06, -zBoard + 0.06, x1 - 0.06, -zBack - 0.06), -0.003, 0x8a7666, { step: 0.12, depth: 0.08, r: 0.011, over: 0.05 });
  // road: grey felt, then hundreds of individually stuffed felt pebbles
  const roadZ0 = zWalk + 0.3, roadZ1 = z1;
  k.cut(rect(x0 + 0.2, -roadZ1, x1 - 0.2, -roadZ0), null, M([0, 0.03, 0], [-Math.PI / 2, 0, 0]), 0x5e5862, { t: 0.04, bevel: 0.015, amp: 0.02, rag: 0, fuzz: 0 });
  const cob = [0x8a8390, 0x9b95a0, 0x7d7584, 0xa59aa0, 0x93877a, 0x857b8c];
  for (let zz = roadZ0 + 0.2; zz < roadZ1 - 0.15; zz += 0.31) {
    const row = Math.round(zz / 0.31);
    for (let xx = x0 + 0.45 + (row % 2) * 0.19; xx < x1 - 0.4; xx += 0.37 + k.r() * 0.05) {
      const w = 0.3 + k.r() * 0.06, d = 0.23 + k.r() * 0.05, o = [];
      for (let q = 0; q < 14; q++) { const a = (q / 14) * TAU, rr = 1 + 0.08 * Math.sin(a * 3 + xx * 7) + 0.05 * Math.sin(a * 5 + zz * 11); o.push([Math.cos(a) * w / 2 * rr, Math.sin(a) * d / 2 * rr]); }
      k.pillow(o, 0.05 + k.r() * 0.025, M([xx, 0.07, zz], [-Math.PI / 2, 0, (k.r() - 0.5) * 0.4]), cob[(k.r() * cob.length) | 0], { rings: 2, flat: 2.6, under: 0.1, amp: 0, fuzz: 1, step: 0.07, vary: 0.06 });
    }
  }
  // pavement: square felt slabs with running-stitch borders; a stuffed kerb
  for (let xx = x0 + 0.5; xx < x1 - 0.5; xx += 0.72) for (let zz = 0.15; zz < zWalk; zz += 0.62) {
    if (xx > -1.2 && xx < 1.0 && zz < 0.8) continue;
    const P = M([xx + 0.33, 0.04, zz + 0.29], [-Math.PI / 2, 0, (k.r() - 0.5) * 0.04]);
    k.pillow(roundRect(-0.33, -0.28, 0.33, 0.28, 0.05), 0.04, P, k.r() < 0.5 ? 0xb9aea0 : 0xa99f94, { rings: 3, flat: 5, under: 0.1, fuzz: 0.9, step: 0.08 });
    if (k.r() < 0.35) k.S.running(P, roundRect(-0.26, -0.21, 0.26, 0.21, 0.04), 0.043, 0x7d7268, { closed: true, len: 0.05, gap: 0.035 });
  }
  k.solid(new RoundedBoxGeometry(x1 - x0 - 0.4, 0.14, 0.18, 2, 0.06), M([(x0 + x1) / 2, 0.09, zWalk + 0.32]), 0x8d8590, { fuzz: 1 });
  k.S.running(M([0, 0.165, zWalk + 0.32], [-Math.PI / 2, 0, 0]), [[x0 + 0.3, 0], [x1 - 0.3, 0]], 0, 0xd9d2c8, { len: 0.07, gap: 0.05 });
  // snow: drifts of carded wool (lumpy, very fuzzy) with a few layered white felt pieces
  const drift = (cx, cz, w, d, n = 3) => {
    for (let i = 0; i < n; i++) {
      const s = 1 - i * 0.22;
      k.lump(w * s * (0.85 + 0.3 * k.r()), 0.1 + 0.06 * (n - i) * k.r() + 0.05, d * s * (0.8 + 0.4 * k.r()), M([cx + (k.r() - 0.5) * w * 0.6, 0.04, cz + (k.r() - 0.5) * d * 0.6], [0, k.r() * TAU, 0]), C.white, { batch: 'wool', fuzz: 3.4, detail: 3, amp: 0.28, freq: 2.0, vary: 0.02 });
    }
    if (k.r() < 0.6) { const o = []; for (let q = 0; q < 20; q++) { const a = (q / 20) * TAU; o.push([Math.cos(a) * w * 1.25 * (1 + 0.15 * Math.sin(a * 3)), Math.sin(a) * d * 1.25]); } k.cut(o, null, M([cx, 0.03, cz], [-Math.PI / 2, 0, 0]), 0xfaf8f3, { t: 0.04, bevel: 0.015, fuzz: 1.6, amp: 0.03 }); }
  };
  for (let xx = x0 + 0.8; xx < x1 - 0.5; xx += 1.3 + k.r() * 0.8) { drift(xx, zWalk + 0.5 + k.r() * 0.15, 0.5 + k.r() * 0.3, 0.2, 2); drift(xx + 0.4, z1 + 0.25, 0.65 + k.r() * 0.4, 0.3, 3); }
  for (let xx = x0 + 0.5; xx < x1; xx += 1.1 + k.r() * 0.7) drift(xx, zBoard - 0.5, 0.7 + k.r() * 0.4, 0.4, 3);
  for (const [cx, cz, w, d] of [[-3.2, 0.25, 0.7, 0.28], [2.1, 0.3, 0.4, 0.22], [-2.3, 0.3, 0.45, 0.22], [3.2, -0.2, 0.55, 0.36], [4.4, -0.05, 0.5, 0.28], [8.4, -0.05, 0.55, 0.32],
    [LAMP.x, LAMP.z, 0.45, 0.4], [TREE.x - 0.9, TREE.z + 0.7, 0.5, 0.35], [-6.5, 0.7, 1.0, 0.6], [-8.0, -1.5, 1.0, 0.7], [10.2, 0.4, 1.1, 0.6], [10.6, -2.5, 1.0, 0.8]]) drift(cx, cz, w, d, 3);
  for (let xx = x0 + 1; xx < x1 - 1; xx += 1.6) drift(xx, -5.4 - k.r() * 0.5, 0.9, 0.5, 2);
  // the white felt ground sheet (under everything)
  k.cut(rect(x0 + 0.08, zBack + 0.08, x1 - 0.08, zBoard - 0.08), null, M([0, 0.0, 0], [Math.PI / 2, 0, 0]).multiply(M([0, 0, -0.035])), 0xf3efe7, { t: 0.04, bevel: 0.015, amp: 0.02, rag: 0, fuzz: 1.2 });
}

// ------------------------------------------------------------------ backdrop: felt hills with stitched edges, a felt moon, embroidered stars
export function backdrop(k, sk) {
  const r = rng(77);
  const hill = (z, y0, amp, freq, phase, col, rise = 0) => {
    const f = (x) => y0 + rise * (x / 28) + amp * (0.55 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7) + 0.15 * Math.sin(x * freq * 5.1));
    const pts = [[-46, -1], [50, -1]]; for (let i = 90; i >= 0; i--) { const x = -46 + (i / 90) * 96; pts.push([x, f(x)]); }
    k.cut(pts, null, M([0, 0, z]), col, { t: 0.12, bevel: 0.05, amp: 0.05, wave: 1.2, rag: 0, fuzz: 0 });
    const topLine = pts.slice(2).reverse();
    // a wool snow cap and a running stitch along the hill's edge
    const cap = [...topLine.map(([x, y]) => [x, y + 0.04]), ...topLine.slice().reverse().map(([x, y]) => [x, y - 0.16 - 0.14 * Math.abs(Math.sin(x * 2.3 + phase)) - 0.06 * Math.sin(x * 7.1)])];
    k.cut(cap, null, M([0, 0, z + 0.09]), 0xf5f2ec, { t: 0.08, bevel: 0.035, amp: 0.04, rag: 0, fuzz: 0 });
    k.S.running(M([0, 0, z + 0.07]), topLine.map(([x, y]) => [x, y - 0.42]), 0, 0x8f9ac0, { len: 0.2, gap: 0.14, r: 0.022 });
    return f;
  };
  hill(-24, 9.5, 2.4, 0.11, 1.4, 0x4a5a8c, 1.6);
  hill(-20, 7.0, 1.8, 0.16, 0.4, 0x3a4878, 1.0);
  const mid = hill(-15.5, 4.6, 1.3, 0.22, 2.1, 0x2d3a66, -0.4);
  for (let i = 0; i < 16; i++) {
    const x = -26 + i * 3.6 + r() * 1.4, y = mid(x) - 0.7, w = 0.9 + r() * 0.7, h = 0.8 + r() * 0.6, ro = 0.5 + r() * 0.4, zz = -15.3 + r() * 0.2;
    k.cut([[-w / 2, 0], [w / 2, 0], [w / 2, h], [0, h + ro], [-w / 2, h]], null, M([x, y, zz]), r() < 0.5 ? 0x5a4c6e : 0x4a5a7a, { t: 0.08, bevel: 0.03, fuzz: 0 });
    for (const sx of [-1, 1]) k.cut(roundRect(sx * w / 4 - 0.11, h * 0.35, sx * w / 4 + 0.11, h * 0.68, 0.03), null, M([x, y, zz + 0.08]), C.glow, { batch: 'glow', t: 0.03, bevel: 0.01, fuzz: 0.3 });
    k.lump(w * 0.55, 0.1, 0.16, M([x, y + h + ro * 0.4, zz + 0.1]), C.white, { batch: 'wool', fuzz: 2.4, detail: 2, amp: 0.3 });
  }
  const near = hill(-10.5, 1.9, 0.9, 0.27, 4.0, 0x223058, 0.2);
  for (let i = 0; i < 34; i++) {
    const x = -30 + i * 1.95 + r() * 1.2, h = 1.4 + r() * 1.6, y = near(x) - 0.5, zz = -10.2 + r() * 0.3;
    k.B.flat.add(firGeo(h, h * 0.32, { tiers: 4, seg: 14, seed: i + 3, lumpAmp: 0.04 }), M([x, y, zz]), r() < 0.5 ? 0x1d3a3a : 0x22424a, { vary: 0.05, extra: 0 });
  }
  // sky: a dark blue cloth backdrop; stars embroidered in gold (cross stitches), a stuffed felt moon
  sk.sky = { geo: new THREE.CylinderGeometry(40, 40, 34, 72, 8, true, Math.PI * 0.5, Math.PI), matrix: M([1, 12, 8]) };
  for (let i = 0; i < 80; i++) {
    const a = Math.PI * 0.6 + r() * Math.PI * 0.8, y = 8 + r() * 18, rr = 39.3;
    const p = V(1 + Math.sin(a) * rr, y, 8 + Math.cos(a) * rr), F = new THREE.Matrix4().lookAt(p, V(1, y, 8), V(0, 1, 0)).setPosition(p), s = 0.06 + r() * 0.1;
    k.S.cross(F, 0, 0, 0, s, 0xf2d48a, 0.022); k.S.addLocal(F, [0, -s * 1.3, 0.005], [0, s * 1.3, 0.005], 0xf2d48a, 0.02);
  }
  const mp = M([-9, 15.5, -19.5]);
  k.pillow(circle(0, 0, 1.5, 48), 0.35, mp, 0xf6ecd0, { batch: 'glow', rings: 5, flat: 3, fuzz: 1, step: 0.15 });
  k.S.blanket(mp, circle(0, 0, 1.5, 48), 0.0, 0xd9c79a, { step: 0.16, depth: 0.12, r: 0.02, over: 0.1 });
  for (const [dx, dy, w] of [[-0.6, -0.5, 2.0], [1.0, 0.4, 1.6]]) k.lump(w, 0.28, 0.2, mp.clone().multiply(M([dx, dy, 0.45])), 0x7a84a8, { batch: 'wool', fuzz: 3, detail: 2, amp: 0.3 });
}

// ------------------------------------------------------------------ the shop door (hinge space)
export function door(k) {
  const w = DOOR.w - 0.02, h = DOOR.h - 0.02;
  k.cut(roundRect(0, 0, w, h, 0.03), null, M([0, 0, -FT / 2]), 0x3f6f57, { t: FT, fuzz: 1 });
  for (const s of [1, -1]) {
    const z = s > 0 ? FT / 2 : -FT / 2 - 0.045;
    for (const [px, py, pw, ph] of [[0.12, 0.18, 0.36, 0.5], [w - 0.48, 0.18, 0.36, 0.5], [0.12, 0.8, 0.36, 0.5], [w - 0.48, 0.8, 0.36, 0.5]]) {
      k.cut(roundRect(px, py, px + pw, py + ph, 0.04), null, M([0, 0, z]), 0x2f5a45, { t: 0.045, fuzz: 0.9 });
      if (s > 0) k.S.running(M([0, 0, z + 0.05]), roundRect(px + 0.05, py + 0.05, px + pw - 0.05, py + ph - 0.05, 0.03), 0, 0x9ccab0, { closed: true, len: 0.04, gap: 0.028 });
    }
  }
  k.cut(roundRect(0.13, 1.42, w - 0.13, 2.0, 0.04), null, M([0, 0, FT / 2]), C.glow, { batch: 'glow', t: 0.03, bevel: 0.01, fuzz: 0.3 });
  k.S.satin(M([0, 0, FT / 2 + 0.035]), [[w / 2, 1.44], [w / 2, 1.98]], 0, C.thread, { width: 0.04, spacing: 0.014 });
  k.S.satin(M([0, 0, FT / 2 + 0.035]), [[0.15, 1.71], [w - 0.15, 1.71]], 0, C.thread, { width: 0.04, spacing: 0.014 });
  k.S.blanket(M([0, 0, 0]), roundRect(0, 0, w, h, 0.03), FT / 2, C.thread, { step: 0.09, depth: 0.06 });
  k.button(M([0, 0, 0]), w - 0.14, 1.05, FT / 2, 0.055, C.gold);
  holly(k, M([w / 2, 2.12, FT / 2 + 0.02]), 5, 0.8);
}
