// Experiment B — handmade felt and textile village: the two buildings.
//
// Construction rules (how a felt-craft maker would build a little house):
//   * walls are thick felt panels, blanket-stitched along their edges and at the corners;
//   * windows are appliqué, not holes: a pane of thin golden felt (lit, as if from inside) sewn onto the wall,
//     a cream frame sewn over it, glazing bars embroidered in satin stitch;
//   * decoration is stitched: running-stitch outlines, embroidered lettering, French knots, sewn-on buttons;
//   * roofs are rows of scalloped felt, each row stitched along its top; snow is fluffy carded wool;
//   * small solid things (steps, sills, stones) are stuffed pillows.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rect, roundRect, circle, ellipse, arch, M, basis, V, TAU, translate2, rng } from '../kit.js';
import { FT } from './kit.js';
import { SHOP, PINK, DOOR } from '../layout.js';

export const C = {
  blue: 0x3a6cb0, blueD: 0x284b80, cream: 0xf0e2c4, creamD: 0xdcc9a3, red: 0xab3330, green: 0x2f7a4c, slate: 0x4c4a66, slateL: 0x5f5c7c,
  stone: 0x9a949c, stoneD: 0x6f6a74, brick: 0xa5493a, pink: 0xe49b93, sage: 0x5f8a6e, plum: 0x8a2830, roofR: 0x9e4636, roofRL: 0xb85a42,
  white: 0xf7f4ee, glow: 0xffd081, gold: 0xe0b04a, thread: 0xf3e9d6, threadD: 0x3a2a22, wood: 0x7a4b2a, holly: 0x2e6b3e, berry: 0xc0262c, ink: 0x2a2630,
};

/** a glowing appliqué window: golden pane, cream frame, embroidered glazing bars, blanket-stitched pane edge */
function window(k, F, x0, y0, x1, y1, z, { rows = 2, cols = 2, frame = 0.1, archTop = false, frameCol = C.cream, sill = true } = {}) {
  const pane = archTop ? arch(x0, y0, x1, y1, 16) : roundRect(x0, y0, x1, y1, 0.04);
  k.cut(pane, null, F.clone().multiply(M([0, 0, z])), C.glow, { batch: 'glow', t: 0.035, bevel: 0.014, fuzz: 0.4 });
  const fz = z + 0.035;
  const outer = archTop ? arch(x0 - frame, y0 - frame, x1 + frame, y1 + frame, 18) : roundRect(x0 - frame, y0 - frame, x1 + frame, y1 + frame, 0.05);
  k.cut(outer, [archTop ? arch(x0 + 0.01, y0 + 0.01, x1 - 0.01, y1 - 0.01, 16) : roundRect(x0 + 0.01, y0 + 0.01, x1 - 0.01, y1 - 0.01, 0.03)], F.clone().multiply(M([0, 0, fz])), frameCol, { t: 0.05, fuzz: 0.8 });
  const sz = fz + 0.05;
  // running stitch around the frame, a little in from each edge
  const inset = (p, d) => p.map(([x, y]) => [x, y]);
  k.S.running(F, archTop ? arch(x0 - frame * 0.5, y0 - frame * 0.5, x1 + frame * 0.5, y1 + frame * 0.5, 18) : rect(x0 - frame * 0.5, y0 - frame * 0.5, x1 + frame * 0.5, y1 + frame * 0.5), sz, C.threadD, { closed: true, len: 0.05, gap: 0.035 });
  void inset;
  // glazing bars: satin stitch in cream floss across the pane
  const bz = z + 0.04;
  for (let i = 1; i < cols; i++) { const x = x0 + (x1 - x0) * i / cols; k.S.satin(F, [[x, y0 + 0.01], [x, (archTop ? y1 - (x1 - x0) / 2 * 0.1 : y1) - 0.01]], bz, C.thread, { width: 0.045, spacing: 0.0095, slant: 0.35 }); }
  for (let j = 1; j < rows; j++) { const y = y0 + (y1 - y0) * j / rows * (archTop ? 0.8 : 1); k.S.satin(F, [[x0 + 0.01, y], [x1 - 0.01, y]], bz, C.thread, { width: 0.045, spacing: 0.0095, slant: 0.35 }); }
  if (sill) {   // a stuffed sill cushion
    const w = (x1 - x0) / 2 + frame + 0.08, cx = (x0 + x1) / 2;
    k.solid(new RoundedBoxGeometry(w * 2, 0.11, 0.2, 2, 0.045), F.clone().multiply(M([cx, y0 - frame - 0.05, z + 0.1])), frameCol, { fuzz: 0.8 });
  }
}
/** a felt shutter: pillow-thin panel, appliqué heart, running-stitch border, hung slightly open */
function shutter(k, F, hingeX, y0, w, h, side, open, col, z) {
  const P = F.clone().multiply(M([hingeX, y0, z], [0, -side * open, 0]));
  const x0 = side > 0 ? 0 : -w, ol = roundRect(x0, 0, x0 + w, h, 0.04);
  k.cut(ol, null, P, col, { t: 0.06, fuzz: 0.9, rag: 0.003 });
  k.S.running(P, roundRect(x0 + 0.05, 0.05, x0 + w - 0.05, h - 0.05, 0.03), 0.065, C.thread, { closed: true, len: 0.045, gap: 0.03 });
  for (let i = 0; i < 4; i++) { const y = h - 0.17 - i * 0.1; k.S.running(P, [[x0 + 0.09, y], [x0 + w - 0.09, y]], 0.064, 0x7a1f1f, { len: 0.04, gap: 0.025 }); }
  const hx = x0 + w / 2, hy = h * 0.2, heart = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * 0.95 - i / 12 * Math.PI * 1.25; heart.push([hx - 0.05 + Math.cos(a) * 0.05, hy + 0.035 + Math.sin(a) * 0.05]); }
  heart.push([hx, hy - 0.09]);
  for (let i = 0; i <= 12; i++) { const a = -Math.PI * 0.3 + i / 12 * Math.PI * 1.25; heart.push([hx + 0.05 + Math.cos(a) * 0.05, hy + 0.035 + Math.sin(a) * 0.05]); }
  k.cut(heart, null, P.clone().multiply(M([0, 0, 0.06])), C.cream, { t: 0.03, bevel: 0.01, fuzz: 0.6, amp: 0.004 });
}
/** felt holly: leaves with a stitched vein, red beads for berries */
export function holly(k, F, n = 5, s = 1) {
  for (let i = 0; i < n; i++) {
    const a = -1.0 + (i / Math.max(1, n - 1)) * 2.0 + (k.r() - 0.5) * 0.3, L = (0.24 + k.r() * 0.06) * s, wd = 0.075 * s, leaf = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8; leaf.push([Math.sin(t * Math.PI) * wd * (j % 2 ? 1.2 : 0.9), t * L]); }
    for (let j = 7; j > 0; j--) { const t = j / 8; leaf.push([-Math.sin(t * Math.PI) * wd * (j % 2 ? 1.2 : 0.9), t * L]); }
    const P = F.clone().multiply(M([0, 0, 0], [0.4 + k.r() * 0.3, (k.r() - 0.5) * 0.5, a]));
    k.cut(leaf, null, P, k.r() < 0.5 ? C.holly : C.green, { t: 0.035, bevel: 0.012, amp: 0.004, fuzz: 0.6, rag: 0.002 });
    k.S.running(P, [[0, L * 0.12], [0, L * 0.85]], 0.04, 0x9bc28a, { len: 0.04, gap: 0.03, r: 0.006 });
  }
  for (let i = 0; i < 3; i++) k.B.bead.add(new THREE.SphereGeometry(0.035 * s, 10, 8), F.clone().multiply(M([(i - 1) * 0.05 * s, 0.03 * s + (i % 2) * 0.035 * s, 0.07 * s])), C.berry, { vary: 0.05 });
}
function planter(k, F, cx, y, w, z) {
  k.solid(new RoundedBoxGeometry(w, 0.24, 0.24, 2, 0.06), F.clone().multiply(M([cx, y - 0.12, z + 0.13])), C.red, { fuzz: 0.9 });
  k.S.running(F.clone().multiply(M([0, 0, z + 0.25 + 0.012])), [[cx - w / 2 + 0.05, y - 0.06], [cx + w / 2 - 0.05, y - 0.06]], 0, C.thread, { len: 0.05, gap: 0.035 });
  for (let i = 0; i < 3; i++) holly(k, F.clone().multiply(M([cx - w / 3 + i * w / 3, y - 0.03, z + 0.13])), 5, 0.9);
}
/** a felt strip with a scalloped lower edge and French knots (eave trim) */
function scallopStrip(k, F, L, h, col, z, { scallop = 0.26, knots = C.red } = {}) {
  const pts = [[0, 0]], n = Math.max(1, Math.round(L / scallop)), sw = L / n;
  for (let i = 0; i < n; i++) for (let j = 0; j <= 10; j++) { const a = Math.PI - (j / 10) * Math.PI; pts.push([i * sw + sw / 2 + Math.cos(a) * sw / 2, -h * 0.5 - Math.sin(a) * h * 0.5]); }
  pts.push([L, 0], [L, 0.1], [0, 0.1]);
  k.cut(pts.reverse(), null, F.clone().multiply(M([0, 0, z])), col, { t: 0.05, fuzz: 0.8 });
  k.S.running(F, [[0.05, 0.03], [L - 0.05, 0.03]], z + 0.05, C.threadD, { len: 0.05, gap: 0.035 });
  for (let i = 0; i < n; i++) k.S.add(V(i * sw + sw / 2 - 0.006, -h * 0.55, z + 0.06).applyMatrix4(F), V(i * sw + sw / 2 + 0.006, -h * 0.55, z + 0.062).applyMatrix4(F), knots, 0.02);
}

// ------------------------------------------------------------------ roofs: scalloped felt rows, carded-wool snow
function feltRoof(k, F, { halfSpan, eaveH, pitch, zf, zb, ov = 0.35, rowH = 0.3, tile = 0.34, col = C.slate, col2 = C.slateL, snowTop = 0.55 }) {
  const c = Math.cos(pitch), s = Math.sin(pitch), run = halfSpan + ov, slopeLen = run / c, L = zf - zb;
  const ridge = eaveH + halfSpan * Math.tan(pitch), eaveY = eaveH - ov * Math.tan(pitch);
  for (const side of [1, -1]) {
    const o = V(side * run, eaveY, side > 0 ? zf : zb), u = V(0, 0, side > 0 ? -1 : 1), v = V(-side * c, s, 0);
    const P = F.clone().multiply(basis(o, u, v));
    k.cut(rect(0, 0, L, slopeLen + 0.03), null, P, 0x2c2a3a, { t: 0.06, rag: 0, fuzz: 0 });
    const rows = Math.ceil(slopeLen / rowH);
    for (let j = 0; j < rows; j++) {
      const y0 = j * rowH, h = rowH * 1.6, phase = (j % 2) * tile / 2, pts = [], n = Math.ceil((L + tile) / tile) + 1;
      for (let i = -1; i < n; i++) { const xa = i * tile + phase - tile / 2; for (let q = 0; q <= 8; q++) { const a = Math.PI + (q / 8) * Math.PI; pts.push([Math.min(L + 0.03, Math.max(-0.03, xa + tile / 2 + Math.cos(a) * tile / 2)), tile * 0.42 + Math.sin(a) * tile * 0.42]); } }
      const lift = 0.06, tilt = -Math.atan2(lift, h), R = P.clone().multiply(M([0, y0, 0.07 + j * 0.002], [tilt, 0, 0])).multiply(M([0, 0, lift]));
      k.cut([...pts, [L + 0.03, h], [-0.03, h]], null, R, j % 3 === 1 ? col2 : col, { t: 0.06, fuzz: 0.8, amp: 0.008 });
      k.S.running(R, [[0.08, tile * 0.75], [L - 0.08, tile * 0.75]], 0.065, C.threadD, { len: 0.06, gap: 0.045, r: 0.0075 });
    }
    // carded wool snow: big soft lumps over the upper slope, a felt drape at the eave
    const top = slopeLen * (1 - snowTop);
    for (let x = 0.3; x < L - 0.2; x += 0.55 + k.r() * 0.25) {
      const y = top + k.r() * 0.25 + (slopeLen - top) * 0.45, w = 0.55 + k.r() * 0.3, d = (slopeLen - top) * (0.55 + k.r() * 0.15);
      k.lump(w, d, 0.16 + k.r() * 0.07, P.clone().multiply(M([x, y, 0.2 + 0.1])), C.white, { batch: 'wool', fuzz: 3.2, detail: 3, amp: 0.25, freq: 2.2, vary: 0.02 });
    }
    for (let x = 0.2; x < L; x += 0.42 + k.r() * 0.2) k.lump(0.28, 0.18, 0.1, P.clone().multiply(M([x, top - 0.05 + k.r() * 0.2, 0.22])), C.white, { batch: 'wool', fuzz: 3, detail: 2, amp: 0.3, freq: 2.5, vary: 0.02 });
  }
  for (let z = zb + 0.2; z < zf; z += 0.4) k.lump(0.32, 0.22, 0.32, F.clone().multiply(M([0, ridge + 0.12, z])), C.white, { batch: 'wool', fuzz: 3.4, detail: 2, amp: 0.3, freq: 2.2, vary: 0.02 });
  return { ridge, heightAt: (x) => ridge - Math.abs(x) * Math.tan(pitch) };
}
function bargeboards(k, F, { halfSpan, eaveH, pitch, ov, z, col = C.cream }) {
  const run = halfSpan + ov, c = Math.cos(pitch), s = Math.sin(pitch), len = run / c;
  for (const side of [1, -1]) {
    const o = V(side * run, eaveH - ov * Math.tan(pitch), z), u = V(-side * c, s, 0), v = side > 0 ? V(-s, -c, 0) : V(s, -c, 0);
    const P = F.clone().multiply(basis(o, u, v)).multiply(side > 0 ? new THREE.Matrix4() : new THREE.Matrix4().makeScale(1, 1, -1));
    const n = Math.round(len / 0.28), sw = len / n, pts = [[0, -0.08]];
    for (let i = 0; i < n; i++) for (let j = 0; j <= 8; j++) { const a = Math.PI - (j / 8) * Math.PI; pts.push([i * sw + sw / 2 + Math.cos(a) * sw / 2, 0.14 + Math.sin(a) * 0.13]); }
    pts.push([len, -0.08]);
    k.cut(pts, null, P, col, { t: 0.06, fuzz: 0.8 });
    k.S.running(P, [[0.1, 0.06], [len - 0.1, 0.06]], side > 0 ? 0.065 : -0.005, C.red, { len: 0.05, gap: 0.035 });
  }
}
function walls(k, Mb, { W, D, H, ridge, gableFront, holes = [], col }) {
  const hw = W / 2;
  const gable = [[-hw, 0], [hw, 0], [hw, H], [0, ridge], [-hw, H]], box = rect(-hw, 0, hw, H);
  const front = gableFront ? gable : box;
  const ol = k.cut(front, holes, Mb, col, { amp: 0.006, wave: 0.5 });
  k.S.blanket(Mb, front, FT, C.thread, { step: 0.09, depth: 0.07 });
  k.cut(front, null, Mb.clone().multiply(M([0, 0, -D + FT])), col, { amp: 0.006, wave: 0.5, rag: 0, fuzz: 0 });
  const sideOutline = gableFront ? rect(0, 0, D, H) : [[0, 0], [D, 0], [D, H], [D / 2, ridge], [0, H]];
  for (const sx of [1, -1]) {
    const P = Mb.clone().multiply(basis(V(sx * (hw - (sx > 0 ? 0 : FT)), 0, sx > 0 ? -FT * 0.5 : -D + FT * 0.5), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    k.cut(sideOutline, null, P, col, { amp: 0.006, wave: 0.5 });
    k.S.blanket(P, sideOutline.map(([x, y]) => [x, y]), sx > 0 ? FT : FT, C.thread, { step: 0.09, depth: 0.07 });
  }
  return ol;
}

// ------------------------------------------------------------------ the blue toy shop
export function shop(k) {
  const { W, D, H, pitch, plinth } = SHOP, hw = W / 2, Mb = M([SHOP.x, 0, SHOP.z]);
  const F = (x = 0, y = 0, z = 0, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  const dO = [DOOR.x - DOOR.w / 2, DOOR.y0, DOOR.x + DOOR.w / 2, DOOR.y0 + DOOR.h];
  walls(k, Mb, { W, D, H, ridge: SHOP.ridge, gableFront: true, holes: [rect(...dO)], col: C.blue });
  // display windows with appliquéd toys, upper windows with shutters and planters, the gable window
  for (const sx of [-1, 1]) {
    const x0 = sx * 1.65 - 0.66, x1 = sx * 1.65 + 0.66;
    window(k, F(), x0, 0.9, x1, 2.3, FT, { rows: 2, cols: 3, frame: 0.11 });
    feltToys(k, F(sx * 1.65, 0.9, FT + 0.04), sx);
    const u0 = sx * 1.35 - 0.42, u1 = sx * 1.35 + 0.42;
    window(k, F(), u0, 3.9, u1, 4.95, FT, { frame: 0.1 });
    shutter(k, F(), u0 - 0.17, 3.86, 0.38, 1.13, -1, 0.35, C.red, FT + 0.01);
    shutter(k, F(), u1 + 0.17, 3.86, 0.38, 1.13, 1, 0.35, C.red, FT + 0.01);
    planter(k, F(), (u0 + u1) / 2, 3.72, 1.05, FT);
    // a small felt pediment over each upper window, with a French knot at its point
    const cx = (u0 + u1) / 2;
    k.cut([[cx - 0.6, 0], [cx + 0.6, 0], [cx, 0.3]], null, F(0, 5.12, FT + 0.01), C.cream, { t: 0.06, fuzz: 0.8 });
    k.S.running(F(0, 5.12, FT + 0.075), [[cx - 0.45, 0.06], [cx, 0.24], [cx + 0.45, 0.06]], 0, C.red, { len: 0.045, gap: 0.03 });
  }
  window(k, F(), -0.36, 5.75, 0.36, 6.85, FT, { archTop: true, frame: 0.09, rows: 2, cols: 2 });
  for (const sx of [1, -1]) {   // side-wall windows, matching the paper set
    const P = Mb.clone().multiply(basis(V(sx * hw, 0, sx > 0 ? -FT * 0.5 : -D + FT * 0.5), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    for (const [x0, y0, x1, y1] of [[1.8, 3.9, 2.7, 4.95], [1.6, 1.0, 3.0, 2.3]]) { const [a, b] = sx > 0 ? [x0, x1] : [D - x1, D - x0]; window(k, P, a, y0, b, y1, 0.0, { frame: 0.09 }); }
  }
  // pilasters, belt course, eave trim
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.17);
    k.cut(roundRect(x - 0.15, plinth, x + 0.15, H - 0.15, 0.03), null, F(0, 0, FT), C.cream, { t: 0.06, fuzz: 0.8 });
    k.S.running(F(0, 0, FT + 0.065), [[x - 0.09, plinth + 0.1], [x - 0.09, H - 0.25]], 0, C.threadD, { len: 0.055, gap: 0.04 });
    k.S.running(F(0, 0, FT + 0.065), [[x + 0.09, plinth + 0.1], [x + 0.09, H - 0.25]], 0, C.threadD, { len: 0.055, gap: 0.04 });
    k.button(F(), x, H - 0.3, FT + 0.06, 0.06, C.gold);
  }
  scallopStrip(k, F(-hw - 0.08, 3.18, 0), W + 0.16, 0.16, C.cream, FT, { scallop: 0.22 });
  scallopStrip(k, F(-hw - 0.1, H + 0.02, 0), W + 0.2, 0.24, C.cream, FT, { scallop: 0.28 });
  // the sign: a stuffed navy board, blanket-stitched in gold, lettering in satin stitch
  const SB = F(0, 3.47, FT + 0.02);
  k.pillow(roundRect(-1.35, -0.26, 1.35, 0.26, 0.08), 0.07, SB, C.blueD, { flat: 5, rings: 4, fuzz: 0.8 });
  k.S.blanket(SB, roundRect(-1.35, -0.26, 1.35, 0.26, 0.08), 0.03, C.gold, { step: 0.08, depth: 0.05, r: 0.008 });
  embroiderWord(k, SB, 'TOYS', 0.3, 0.075);
  k.lump(1.3, 0.12, 0.09, F(0, 3.75, FT + 0.12), C.white, { batch: 'wool', fuzz: 3, detail: 2, amp: 0.3, freq: 2.5 });
  // plinth stones (stuffed), door frame, steps
  k.cut(rect(-hw - 0.03, 0, hw + 0.03, plinth), null, F(0, 0, FT), C.stoneD, { t: 0.04, fuzz: 0.5 });
  for (let row = 0; row < 2; row++) {
    let x = -hw + row * 0.18;
    while (x < hw - 0.05) {
      const w = 0.34 + k.r() * 0.26, x1 = Math.min(hw, x + w);
      if (!(x1 > dO[0] - 0.05 && x < dO[2] + 0.05)) k.pillow(roundRect(x + 0.02, row * 0.21 + 0.03, x1 - 0.02, row * 0.21 + 0.21, 0.06), 0.05, F(0, 0, FT + 0.04), k.r() < 0.5 ? C.stone : 0xa8a2aa, { flat: 3, rings: 3, fuzz: 1 });
      x = x1;
    }
  }
  const [d0, , d1, dt] = dO;
  const frame = [[d0 - 0.17, plinth], [d0 + 0.01, plinth], [d0 + 0.01, dt + 0.01], [d1 - 0.01, dt + 0.01], [d1 - 0.01, plinth], [d1 + 0.17, plinth], [d1 + 0.17, dt + 0.2], [d0 - 0.17, dt + 0.2]];
  k.cut(frame, null, F(0, 0, FT), C.cream, { t: 0.06, fuzz: 0.8 });
  k.S.running(F(0, 0, FT + 0.065), [[d0 - 0.09, plinth + 0.05], [d0 - 0.09, dt + 0.11], [d1 + 0.09, dt + 0.11], [d1 + 0.09, plinth + 0.05]], 0, C.red, { len: 0.05, gap: 0.035 });
  k.solid(new RoundedBoxGeometry(1.6, 0.22, 0.55, 2, 0.08), F(0, 0.11, 0.29), C.stone, { fuzz: 1 });
  k.solid(new RoundedBoxGeometry(1.3, 0.22, 0.3, 2, 0.08), F(0, 0.33, 0.16), C.stone, { fuzz: 1 });
  // the room behind the door (seen when it opens)
  interior(k, Mb);
  awning(k, Mb, -2.45, 2.45, 3.02, 1.1);
  const roof = feltRoof(k, Mb, { halfSpan: hw, eaveH: H, pitch, zf: 0.3, zb: -D - 0.3, ov: 0.35 });
  bargeboards(k, Mb, { halfSpan: hw, eaveH: H, pitch, ov: 0.35, z: 0.3 });
  chimney(k, Mb, 1.35, -2.4, roof.heightAt(1.35), 9.2);
}

/** satin-stitched lettering: each letter is a set of strokes */
function embroiderWord(k, F, word, h, z) {
  const w = h * 0.7, gap = h * 0.3; let x = -((word.length * (w + gap)) - gap) / 2;
  const strokes = {
    T: (x) => [[[x, h / 2], [x + w, h / 2]], [[x + w / 2, h / 2], [x + w / 2, -h / 2]]],
    O: (x) => { const p = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; p.push([x + w / 2 + Math.cos(a) * w * 0.45, Math.sin(a) * h * 0.47]); } return [p]; },
    Y: (x) => [[[x, h / 2], [x + w / 2, 0]], [[x + w, h / 2], [x + w / 2, 0]], [[x + w / 2, 0], [x + w / 2, -h / 2]]],
    S: (x) => { const p = []; for (let i = 0; i <= 28; i++) { const t = i / 28, a = t < 0.5 ? (0.15 + t * 2 * 1.35) * Math.PI : (0.5 - (t - 0.5) * 2 * 1.35) * Math.PI, cy = t < 0.5 ? h / 4 : -h / 4; p.push([x + w / 2 + Math.cos(a) * w * 0.42, cy + Math.sin(a) * h * 0.24]); } return [p]; },
  };
  for (const ch of word) { for (const s of strokes[ch](x)) k.S.satin(F, s, z, C.gold, { width: 0.055, spacing: 0.013, r: 0.0065, slant: 0.4 }); x += w + gap; }
}

/** appliquéd toys in the display windows: a teddy with an embroidered face, a rocking horse, a drum and a train */
function feltToys(k, F, sx) {
  const at = (x, y) => F.clone().multiply(M([x, y, 0]));
  if (sx < 0) {
    k.cut(ellipse(0, 0.22, 0.17, 0.2, 20), null, at(-0.3, 0.08), 0x9a6a46, { t: 0.04, bevel: 0.015, fuzz: 1.2 });
    k.cut(circle(0, 0.52, 0.13, 18), null, at(-0.3, 0.08), 0x9a6a46, { t: 0.045, bevel: 0.015, fuzz: 1.2 });
    for (const e of [-1, 1]) { k.cut(circle(e * 0.1, 0.64, 0.05, 12), null, at(-0.3, 0.08), 0x7a4a2e, { t: 0.04, bevel: 0.012, fuzz: 1.2 }); k.S.cross(at(-0.3, 0.08), e * 0.045, 0.55, 0.05, 0.01, C.threadD, 0.006); }
    k.cut(ellipse(0, 0.2, 0.09, 0.11, 14), null, at(-0.3, 0.08).multiply(M([0, 0, 0.04])), 0xe2c39a, { t: 0.02, bevel: 0.008, fuzz: 0.8 });
    k.S.running(at(-0.3, 0.08), [[-0.04, 0.48], [0, 0.46], [0.04, 0.48]], 0.05, C.threadD, { len: 0.02, gap: 0.004, r: 0.005 });
    const horse = [[-0.25, 0.05], [0.25, 0.05], [0.18, 0.12], [0.16, 0.32], [0.3, 0.55], [0.22, 0.6], [0.08, 0.44], [-0.14, 0.42], [-0.22, 0.48], [-0.24, 0.3], [-0.16, 0.12]];
    k.cut(horse, null, at(0.27, 0.06), C.red, { t: 0.05, fuzz: 1 });
    k.S.running(at(0.27, 0.06), [[-0.2, 0.08], [0.2, 0.08], [0.13, 0.32], [0.24, 0.52]], 0.052, C.thread, { len: 0.035, gap: 0.025, r: 0.006 });
    k.cut([[-0.32, 0.0], [0.32, 0.0], [0.26, 0.06], [-0.26, 0.06]], null, at(0.27, 0.04), C.wood, { t: 0.05, fuzz: 0.8 });
  } else {
    k.cut(roundRect(-0.17, 0, 0.17, 0.26, 0.03), null, at(-0.32, 0.06), C.red, { t: 0.05, fuzz: 1 });
    k.S.running(at(-0.32, 0.06), [[-0.15, 0.24], [-0.08, 0.04], [0, 0.24], [0.08, 0.04], [0.15, 0.24]], 0.055, C.gold, { len: 0.03, gap: 0.01, r: 0.006 });
    const train = [[-0.32, 0.06], [0.2, 0.06], [0.2, 0.22], [0.08, 0.22], [0.08, 0.36], [-0.04, 0.36], [-0.04, 0.22], [-0.32, 0.22]];
    k.cut(train, null, at(0.22, 0.04), C.green, { t: 0.05, fuzz: 1 });
    k.cut(roundRect(0.2, 0.06, 0.38, 0.26, 0.03), null, at(0.22, 0.04), C.blueD, { t: 0.05, fuzz: 1 });
    for (const wx of [-0.22, -0.02, 0.24]) k.button(at(0.22, 0.04), wx, 0.07, 0.05, 0.055, C.ink, C.thread);
  }
}

function awning(k, Mb, x0, x1, yTop, depth) {
  const yFront = yTop - 0.42, n = Math.round((x1 - x0) / 0.35), sw = (x1 - x0) / n, slope = V(0, yFront - yTop, depth), sl = slope.length();
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * sw, col = i % 2 ? C.cream : C.green;
    const P = Mb.clone().multiply(basis(V(xa, yTop, FT), V(1, 0, 0), slope)).multiply(M([0, 0, (i % 2) * 0.006]));
    k.cut(rect(-0.006, 0, sw + 0.006, sl), null, P, col, { t: 0.05, fuzz: 0.8, amp: 0.004 });
    // the valance: a little stuffed scallop for each stripe
    const tab = [[0, 0], [sw, 0], [sw, -0.17]]; for (let q = 0; q <= 12; q++) { const a = (q / 12) * Math.PI; tab.push([sw / 2 + Math.cos(a) * sw / 2, -0.17 - Math.sin(a) * 0.16]); } tab.push([0, -0.17]);
    const T2 = Mb.clone().multiply(M([xa, yFront + 0.01, FT + depth]));
    k.pillow(tab, 0.04, T2, col, { flat: 3, rings: 3, fuzz: 0.8, step: 0.03 });
    k.S.running(T2, tab.slice(2, -1), 0.03, i % 2 ? C.green : C.thread, { len: 0.035, gap: 0.025, r: 0.006 });
  }
  k.S.running(Mb.clone().multiply(basis(V(x0, yTop, FT + 0.06), V(1, 0, 0), slope)), [[0.05, 0.08], [x1 - x0 - 0.05, 0.08]], 0, C.threadD, { len: 0.06, gap: 0.04 });
  for (const x of [x0, x1]) k.cut([[0, yTop], [depth + 0.02, yFront], [depth + 0.02, yFront - 0.17], [0.2, yTop - 0.45]], null, Mb.clone().multiply(basis(V(x + (x > 0 ? -0.025 : 0.025), 0, FT), V(0, 0, 1), V(0, 1, 0))), C.green, { t: 0.05, fuzz: 0.8 });
  for (let i = 0; i < 4; i++) { const xa = x0 + 0.5 + k.r() * (x1 - x0 - 1); k.lump(0.3 + k.r() * 0.2, 0.18, 0.06, Mb.clone().multiply(basis(V(xa, yTop, FT + 0.08), V(1, 0, 0), slope)).multiply(M([0, 0.3 + k.r() * 0.6, 0.03])), C.white, { batch: 'wool', fuzz: 2.6, detail: 2, amp: 0.3, freq: 2.5 }); }
}

function chimney(k, Mb, x, z, yRoof, yTop) {
  const w = 0.74, d = 0.82, y0 = yRoof - 0.6, h = yTop - y0;
  k.solid(new RoundedBoxGeometry(w, h, d, 2, 0.06), Mb.clone().multiply(M([x, y0 + h / 2, z])), C.brick, { fuzz: 1 });
  // embroidered bricks: running-stitch courses and staggered joints on the two faces you can see
  for (const face of [0, 1]) {
    const P = face === 0 ? Mb.clone().multiply(M([x, y0, z + d / 2 + 0.004])) : Mb.clone().multiply(basis(V(x + w / 2 + 0.004, y0, z + d / 2), V(0, 0, -1), V(0, 1, 0))).multiply(M([d / 2, 0, 0]));
    const fw = face === 0 ? w : d;
    for (let row = 0, y = 0.62; y < h - 0.1; row++, y += 0.13) {
      k.S.running(P, [[-fw / 2 + 0.05, y], [fw / 2 - 0.05, y]], 0.004, C.thread, { len: 0.05, gap: 0.03, r: 0.0065 });
      for (let bx = -fw / 2 + (row % 2 ? 0.12 : 0.24); bx < fw / 2 - 0.05; bx += 0.24) k.S.addLocal(P, [bx, y + 0.02, 0.004], [bx, y + 0.11, 0.004], C.thread, 0.0065);
    }
  }
  k.solid(new RoundedBoxGeometry(w + 0.2, 0.16, d + 0.2, 2, 0.06), Mb.clone().multiply(M([x, yTop + 0.08, z])), C.stoneD, { fuzz: 1 });
  k.lump(0.5, 0.18, 0.45, Mb.clone().multiply(M([x, yTop + 0.22, z])), C.white, { batch: 'wool', fuzz: 3.4, detail: 3, amp: 0.3, freq: 2.2 });
  // a wisp of grey wool smoke
  for (let i = 0; i < 5; i++) { const t = i / 4; k.lump(0.22 + t * 0.28, 0.18 + t * 0.2, 0.2 + t * 0.2, Mb.clone().multiply(M([x + 0.15 + t * 0.9 + 0.12 * Math.sin(i * 2.1), yTop + 0.55 + t * 1.6, z - t * 0.4])), i % 2 ? 0xb9b2b8 : 0xa8a0a8, { batch: 'wool', fuzz: 4.5, detail: 2, amp: 0.35, freq: 2.4, vary: 0.04 }); }
}

function interior(k, Mb) {
  const w = 1.9, d = 3.0, y0 = SHOP.plinth, h = 2.5, P = (x, y, z, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  k.cut(rect(-w / 2, 0, w / 2, d), null, P(0, y0, 0, [-Math.PI / 2, 0, 0]), 0x8a5a36, { t: 0.05, fuzz: 0 });
  k.cut(rect(-w / 2, 0, w / 2, h), null, P(0, y0, -d), 0xe9d3a6, { t: 0.05, fuzz: 0 });
  for (const s of [1, -1]) k.cut(rect(-d, 0, 0, h), null, P(s * w / 2, y0, 0, [0, -Math.PI / 2, 0]), 0xd8b98a, { t: 0.05, fuzz: 0 });
  const cols = [C.red, C.blue, C.green, C.gold, 0x9a4f8f, C.cream];
  for (const sy of [0.9, 1.5, 2.1]) {
    k.solid(new RoundedBoxGeometry(w - 0.1, 0.06, 0.3, 2, 0.02), P(0, y0 + sy, -d + 0.15), C.wood, { fuzz: 0.4 });
    let x = -w / 2 + 0.12;
    while (x < w / 2 - 0.2) { const bw = 0.12 + k.r() * 0.14, bh = 0.12 + k.r() * 0.22; k.solid(new RoundedBoxGeometry(bw, bh, 0.16, 2, 0.03), P(x + bw / 2, y0 + sy + 0.03 + bh / 2, -d + 0.15), cols[(k.r() * cols.length) | 0], { fuzz: 1 }); x += bw + 0.04; }
  }
  k.solid(new RoundedBoxGeometry(1.0, 0.85, 0.4, 2, 0.06), P(0.35, y0 + 0.425, -1.6), C.wood, { fuzz: 0.6 });
}

// ------------------------------------------------------------------ the pink house
export function pinkHouse(k) {
  const { W, D, H, pitch, plinth } = PINK, hw = W / 2, Mb = M([PINK.x, 0, PINK.z]);
  const F = (x = 0, y = 0, z = 0, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  const dO = [1.25 - 0.44, plinth, 1.25 + 0.44, plinth + 1.95];
  walls(k, Mb, { W, D, H, ridge: PINK.ridge, gableFront: false, col: C.pink });
  for (const x of [-0.95, 0.95]) {
    window(k, F(), x - 0.4, 2.65, x + 0.4, 3.55, FT, { frame: 0.09 });
    shutter(k, F(), x - 0.4 - 0.16, 2.62, 0.34, 0.96, -1, 0.3, C.sage, FT + 0.01);
    shutter(k, F(), x + 0.4 + 0.16, 2.62, 0.34, 0.96, 1, 0.38, C.sage, FT + 0.01);
    planter(k, F(), x, 2.47, 0.95, FT);
  }
  for (const sx of [1, -1]) {
    const P = Mb.clone().multiply(basis(V(sx * (hw - (sx > 0 ? 0 : FT)), 0, sx > 0 ? -FT * 0.5 : -D + FT * 0.5), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    window(k, P, D / 2 - 0.35, 3.95, D / 2 + 0.35, 4.85, FT, { archTop: true, frame: 0.08, sill: false });
    bargeboards(k, Mb.clone().multiply(basis(V(sx * (hw + 0.34 + FT), 0, -D / 2), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0))), { halfSpan: D / 2, eaveH: H, pitch, ov: 0.35, z: 0 });
  }
  // door: a plum felt door with stitched panels, a glowing fanlight, a button knob and a wreath
  const DF = F(0, 0, FT);
  k.cut(arch(dO[0] - 0.13, dO[1], dO[2] + 0.13, dO[3] + 0.13, 16), [arch(...dO, 14)], DF, C.cream, { t: 0.06, fuzz: 0.8 });
  k.cut(arch(dO[0] + 0.01, dO[1], dO[2] - 0.01, dO[3], 14), null, F(0, 0, FT - 0.02), C.plum, { t: 0.06, fuzz: 0.8 });
  k.cut(arch(dO[0] + 0.1, dO[3] - 0.48, dO[2] - 0.1, dO[3] - 0.08, 12), null, F(0, 0, FT + 0.04), C.glow, { batch: 'glow', t: 0.03, bevel: 0.01, fuzz: 0.3 });
  k.S.satin(F(), [[1.25, dO[3] - 0.47], [1.25, dO[3] - 0.1]], FT + 0.075, C.thread, { width: 0.04, spacing: 0.014 });
  for (const yy of [0.25, 0.85]) for (const xx of [-0.2, 0.2]) k.S.running(F(0, 0, FT + 0.045), roundRect(1.25 + xx - 0.14, plinth + yy, 1.25 + xx + 0.14, plinth + yy + 0.5, 0.04), 0, 0xd9a0a0, { closed: true, len: 0.045, gap: 0.03 });
  k.button(F(), 1.25 - 0.3, plinth + 0.95, FT + 0.04, 0.05, C.gold);
  wreath(k, F(1.25, plinth + 1.33, FT + 0.06));
  k.solid(new RoundedBoxGeometry(1.25, 0.2, 0.5, 2, 0.07), F(1.25, 0.1, 0.25), C.stone, { fuzz: 1 });
  // bay window: a stuffed three-sided bay with appliqué windows and a little scalloped roof
  const bx = -0.8, bw = 1.3, depth = 0.5;
  k.solid(new RoundedBoxGeometry(bw, 2.25, depth, 3, 0.12), F(bx, 1.125, depth / 2 + FT), C.pink, { fuzz: 1 });
  window(k, F(0, 0, depth + FT - 0.0), bx - 0.45, 1.0, bx + 0.45, 1.95, 0.0, { rows: 2, cols: 2, frame: 0.08, sill: false });
  k.solid(new RoundedBoxGeometry(bw + 0.2, 0.14, depth + 0.2, 2, 0.06), F(bx, 2.32, depth / 2 + FT + 0.05), C.roofR, { fuzz: 1 });
  k.lump(0.62, 0.1, 0.28, F(bx, 2.45, depth / 2 + FT + 0.06), C.white, { batch: 'wool', fuzz: 3, detail: 2, amp: 0.3, freq: 2.5 });
  k.solid(new RoundedBoxGeometry(bw + 0.06, 0.35, depth + 0.06, 2, 0.06), F(bx, 0.17, depth / 2 + FT), C.stone, { fuzz: 1 });
  // eave trim, corner boards, plinth
  scallopStrip(k, F(-hw - 0.25, H - 0.02, 0.36 - FT), W + 0.5, 0.24, C.cream, FT, { scallop: 0.26, knots: C.sage });
  for (const sx of [-1, 1]) { k.cut(roundRect(sx * hw - 0.14, plinth, sx * hw + 0.0, H, 0.03).map(([x, y]) => [sx > 0 ? x : x + 0.14, y]), null, F(0, 0, FT), C.cream, { t: 0.05, fuzz: 0.8 }); }
  k.cut(rect(-hw - 0.03, 0, hw + 0.03, plinth), null, F(0, 0, FT), C.stoneD, { t: 0.04, fuzz: 0.5 });
  for (let x = -hw; x < hw;) { const w = 0.28 + k.r() * 0.25, x1 = Math.min(hw, x + w); if (!(x1 > dO[0] - 0.1 && x < dO[2] + 0.1) && !(x1 > bx - bw / 2 - 0.05 && x < bx + bw / 2 + 0.05)) k.pillow(roundRect(x + 0.02, 0.04, x1 - 0.02, plinth - 0.03, 0.06), 0.05, F(0, 0, FT + 0.04), 0xa79a8c, { flat: 3, rings: 3 }); x = x1; }
  const R = Mb.clone().multiply(M([0, 0, -D / 2], [0, Math.PI / 2, 0]));
  const roof = feltRoof(k, R, { halfSpan: D / 2, eaveH: H, pitch, zf: hw + 0.32, zb: -hw - 0.32, ov: 0.38, col: C.roofR, col2: C.roofRL, tile: 0.3, rowH: 0.27, snowTop: 0.6 });
  chimney(k, R, -0.9, -1.0, roof.heightAt(-0.9), PINK.ridge + 0.9);
}

export function wreath(k, F) {
  const ring = new THREE.TorusGeometry(0.17, 0.065, 10, 28);
  k.solid(ring, F.clone(), C.holly, { fuzz: 2.0 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; k.B.bead.add(new THREE.SphereGeometry(0.03, 8, 6), F.clone().multiply(M([Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.06])), C.berry, {}); }
  const bow = (s) => { const g = new THREE.TorusGeometry(0.06, 0.022, 8, 16); g.scale(1.3, 0.8, 0.6); return g; };
  for (const s of [-1, 1]) k.solid(bow(s), F.clone().multiply(M([s * 0.07, -0.17, 0.07], [0, 0, s * 0.3])), C.berry, { fuzz: 0.6 });
  k.solid(new THREE.SphereGeometry(0.03, 8, 6), F.clone().multiply(M([0, -0.17, 0.09])), C.berry, { fuzz: 0.6 });
}
