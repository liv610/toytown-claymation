// Experiment C — the two hero buildings, built the way a textile artist would build them.
//
//  Blue toy shop (hero): wool-felt walls joined with whipped corner seams; shadow-box display windows full of small
//  handmade toys (felt bear, painted wooden train and blocks, a drum); upper windows with gathered curtains glowing
//  from inside, framed in crisp cardstock; felt shutters embroidered with daisies; layered felt lettering; a sewn
//  awning of striped woven cotton with a bound scalloped hem; felt shingle rows under cotton batting; paper lace eaves.
//  Pink house: walls of pink woven cotton, quilted below the windows; a patchwork roof of stuffed calico shingles.
import * as THREE from 'three';
import { rect, roundRect, circle, ellipse, arch, M, basis, V, TAU, translate2 } from '../kit.js';
import { laceStrip } from '../paper/build.js';
import { TF } from './kit.js';
import { SHOP, PINK, DOOR } from '../layout.js';

export const C = {
  blue: 0x3c6aa8, blueD: 0x27497c, cream: 0xf1e3c6, creamD: 0xdcc8a2, red: 0xae3430, green: 0x2f7a4c, greenD: 0x24603c,
  slate: 0x4d4a68, slateL: 0x605d7e, stone: 0x9c95a0, brick: 0xa8503e, pink: 0xe2a09a, pinkD: 0xc98580, sage: 0x6b9078, plum: 0x8a2a34,
  white: 0xf8f5ee, glow: 0xffc985, gold: 0xd9a441, thread: 0xf4ead6, threadD: 0x3a2c26, wood: 0x8a5a34, woodL: 0xb07a48, holly: 0x2e6b3e, berry: 0xc0262c, ink: 0x2c2832,
  card: 0xf3e8d2, calico: [0xb4545a, 0xd7a35a, 0x6f8f7c, 0x8a5a7a, 0xc77a5e, 0x5e7896],
};
const lean = (x, z) => M([0, 0, 0], [x, 0, z]);

// ------------------------------------------------------------------ parts
/** a crisp cardstock window frame, two layers, panes cut out */
function cardFrame(k, F, x0, y0, x1, y1, z, { rows = 2, cols = 2, bar = 0.04, border = 0.09, archTop = false } = {}) {
  const pw = (x1 - x0 - bar * (cols - 1)) / cols, ph = (y1 - y0 - bar * (rows - 1)) / rows, panes = [];
  if (archTop) panes.push(arch(x0, y0, x1, y1, 14));
  else for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) panes.push(rect(x0 + i * (pw + bar), y0 + j * (ph + bar), x0 + i * (pw + bar) + pw, y0 + j * (ph + bar) + ph));
  const outer = archTop ? arch(x0 - border, y0 - border, x1 + border, y1 + border, 16) : rect(x0 - border, y0 - border, x1 + border, y1 + border);
  k.cut(outer, panes, F.clone().multiply(M([0, 0, z + 0.025])), C.card, { batch: 'card', t: 0.025, amp: 0.003 });
  if (archTop) { const cx = (x0 + x1) / 2; k.cut(rect(cx - bar / 2, y0, cx + bar / 2, y1 - 0.02), null, F.clone().multiply(M([0, 0, z + 0.025])), C.card, { batch: 'card', t: 0.025, amp: 0 }); }
  const b2 = border + 0.06;
  const mould = archTop ? arch(x0 - b2, y0 - b2, x1 + b2, y1 + b2, 16) : rect(x0 - b2, y0 - b2, x1 + b2, y1 + b2);
  k.cut(mould, [archTop ? arch(x0 - border + 0.02, y0 - border + 0.02, x1 + border - 0.02, y1 + border - 0.02, 16) : rect(x0 - border + 0.02, y0 - border + 0.02, x1 + border - 0.02, y1 + border - 0.02)], F.clone().multiply(M([0, 0, z])), C.creamD, { batch: 'card', t: 0.025, amp: 0.003 });
}
/** a gathered curtain lit from inside: a strip of thin cotton with soft folds, behind an opening */
function curtain(k, F, x0, y0, x1, y1, z, color = C.glow) {
  const w = x1 - x0 + 0.12, h = y1 - y0 + 0.12, nx = Math.max(8, Math.round(w / 0.03)), ny = 4, pos = [], idx = [], folds = Math.max(3, Math.round(w / 0.11));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const u = i / nx, v = j / ny; pos.push(x0 - 0.06 + u * w, y0 - 0.06 + v * h, z - 0.03 * Math.abs(Math.sin(u * folds * Math.PI)) * (0.6 + 0.4 * v)); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  k.B.glow.add(g, F, color, { vary: 0.04 });
}
/** felt shutter, blanket-stitched, with an embroidered daisy chain; hung slightly open */
function shutter(k, F, hingeX, y0, w, h, side, open, col, z) {
  const P = F.clone().multiply(M([hingeX, y0, z], [0, -side * open, 0]));
  const x0 = side > 0 ? 0 : -w, ol = roundRect(x0, 0, x0 + w, h, 0.04);
  k.cut(ol, null, P, col, { t: 0.05, amp: 0.008 });
  k.S.running(P, roundRect(x0 + 0.045, 0.045, x0 + w - 0.045, h - 0.045, 0.03), 0.052, C.thread, { closed: true, len: 0.04, gap: 0.028, r: 0.007 });
  const cx = x0 + w / 2;
  k.S.daisy(P, cx, h * 0.68, 0.052, 0.06, C.cream, 0xe8b84a, 6); k.S.daisy(P, cx, h * 0.32, 0.052, 0.05, 0xf3b6b0, 0xe8b84a, 5);
  for (const [a, b] of [[h * 0.4, h * 0.6]]) k.S.addLocal(P, [cx, a, 0.052], [cx, b, 0.052], 0x7aa36a, 0.007);
  for (const s of [-1, 1]) k.S.addLocal(P, [cx, h * 0.5, 0.052], [cx + s * 0.05, h * 0.55, 0.052], 0x7aa36a, 0.009);
}
/** a painted wooden planter with felt holly and glass-bead berries */
function planter(k, F, cx, y, w, z) {
  k.solid(new THREE.BoxGeometry(w, 0.2, 0.22, 1, 1, 1), F.clone().multiply(M([cx, y - 0.1, z + 0.12])), C.red, { batch: 'paint', smooth: false });
  for (let i = 0; i < 7; i++) holly(k, F.clone().multiply(M([cx - w / 2 + 0.1 + i * (w - 0.2) / 6, y, z + 0.13], [0, 0, (i - 3) * 0.08])), 3, 0.75);
}
export function holly(k, F, n = 3, s = 1) {
  for (let i = 0; i < n; i++) {
    const a = -0.9 + (i / Math.max(1, n - 1)) * 1.8 + (k.r() - 0.5) * 0.3, L = 0.22 * s, wd = 0.07 * s, leaf = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8; leaf.push([Math.sin(t * Math.PI) * wd * (j % 2 ? 1.25 : 0.85), t * L]); }
    for (let j = 7; j > 0; j--) { const t = j / 8; leaf.push([-Math.sin(t * Math.PI) * wd * (j % 2 ? 1.25 : 0.85), t * L]); }
    const P = F.clone().multiply(M([0, 0, 0], [0.5 + k.r() * 0.3, (k.r() - 0.5) * 0.5, a]));
    k.cut(leaf, null, P, k.r() < 0.5 ? C.holly : C.green, { t: 0.02, bevel: 0.006, amp: 0.002 });
    k.S.addLocal(P, [0, L * 0.15, 0.022], [0, L * 0.8, 0.022], 0x9cc48a, 0.005);
  }
  for (let i = 0; i < 3; i++) k.B.bead.add(new THREE.SphereGeometry(0.03 * s, 8, 6), F.clone().multiply(M([(i - 1) * 0.04 * s, 0.03 * s + (i % 2) * 0.03 * s, 0.05 * s])), C.berry, { vary: 0.05 });
}
/** a shadow-box display window: reveals, a wallpapered back wall, a wooden shelf, small handmade toys */
function displayBox(k, F, x0, y0, x1, y1, sx) {
  const d = 0.62, w = x1 - x0, h = y1 - y0, P = (x, y, z, r = [0, 0, 0]) => F.clone().multiply(M([x, y, z], r));
  k.cut(rect(0, 0, w, d), null, P(x0, y0, 0, [-Math.PI / 2, 0, 0]).multiply(M([0, -d, 0])), C.woodL, { batch: 'paint', t: 0.03, amp: 0 });
  k.cut(rect(0, 0, w, d), null, P(x0, y1 + 0.03, 0, [-Math.PI / 2, 0, 0]).multiply(M([0, -d, 0])), C.creamD, { t: 0.03, amp: 0 });
  for (const xx of [x0, x1]) k.cut(rect(-d, 0, 0, h), null, P(xx, y0, 0, [0, -Math.PI / 2, 0]).multiply(M([0, 0, xx === x0 ? -0.03 : 0])), C.cream, { t: 0.03, amp: 0 });
  k.cut(rect(x0, y0, x1, y1), null, P(0, 0, -d - 0.03), 0xe6c27a, { batch: 'print', t: 0.03, amp: 0, extra: sx < 0 ? 0 : 2 });
  // a glow strip hidden under the top reveal (the little display light)
  k.cut(rect(x0 + 0.05, -0.06, x1 - 0.05, 0.0), null, P(0, y1 - 0.01, -0.12, [Math.PI / 2, 0, 0]), 0xffe2b0, { batch: 'glow', t: 0.01, amp: 0 });
  const toy = (x, z) => F.clone().multiply(M([x, y0 + 0.03, -z], [0, 0, 0], 1.3));
  if (sx < 0) {
    teddy(k, toy(x0 + 0.38, 0.32), 1.0);
    blocks(k, toy(x0 + 0.85, 0.25));
    drum(k, toy(x1 - 0.25, 0.42));
  } else {
    train(k, toy(x0 + 0.62, 0.3));
    dollhouse(k, toy(x1 - 0.3, 0.42));
    k.lump(0.06, 0.06, 0.06, toy(x0 + 0.2, 0.2).multiply(M([0, 0.06, 0])), C.berry, { batch: 'felt' });
  }
}
// small handmade toys (each one built like the real thing, at toy scale)
function teddy(k, F, s = 1) {
  const brown = 0x9a6a46, at = (x, y, z) => F.clone().multiply(M([x * s, y * s, z * s]));
  k.lump(0.13 * s, 0.15 * s, 0.11 * s, at(0, 0.15, 0), brown, { detail: 2, amp: 0.05 });
  k.lump(0.11 * s, 0.1 * s, 0.1 * s, at(0, 0.36, 0.01), brown, { detail: 2, amp: 0.05 });
  for (const e of [-1, 1]) { k.lump(0.04 * s, 0.04 * s, 0.025 * s, at(e * 0.08, 0.45, 0), 0x7a4a2e, { detail: 1, amp: 0 }); k.lump(0.045 * s, 0.08 * s, 0.045 * s, at(e * 0.13, 0.16, 0.03), brown, { detail: 1, amp: 0.05 }); k.lump(0.05 * s, 0.045 * s, 0.07 * s, at(e * 0.07, 0.03, 0.05), brown, { detail: 1, amp: 0.05 }); }
  k.lump(0.045 * s, 0.035 * s, 0.03 * s, at(0, 0.33, 0.1), 0xe2c39a, { detail: 1, amp: 0 });
  for (const e of [-1, 1]) k.B.bead.add(new THREE.SphereGeometry(0.012 * s, 6, 4), at(e * 0.04, 0.39, 0.095), 0x111111);
  k.S.add(V(-0.012, 0.32, 0.13).multiplyScalar(s).applyMatrix4(F), V(0.012, 0.32, 0.13).multiplyScalar(s).applyMatrix4(F), C.threadD, 0.005 * s);
  k.solid(new THREE.TorusGeometry(0.075 * s, 0.014 * s, 6, 14).rotateX(Math.PI / 2 - 0.2), at(0, 0.27, 0.01), C.red, { batch: 'woven' });
}
function blocks(k, F) {
  const cols = [C.red, 0x3d6fb0, 0xe0b04a, C.green];
  [[0, 0, 0], [0.14, 0, 0.02], [0.07, 0.13, 0.01]].forEach(([x, y, z], i) => k.solid(new THREE.BoxGeometry(0.12, 0.12, 0.12), F.clone().multiply(M([x, y + 0.06, z], [0, i * 0.3, 0])), cols[i], { batch: 'paint', smooth: false }));
}
function drum(k, F) {
  k.solid(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 16), F.clone().multiply(M([0, 0.09, 0])), C.red, { batch: 'paint', smooth: false });
  for (const y of [0.01, 0.17]) k.solid(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 16), F.clone().multiply(M([0, y, 0])), C.gold, { batch: 'paint', smooth: false });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, b = a + TAU / 16; k.S.add(V(Math.cos(a) * 0.123, 0.025, Math.sin(a) * 0.123).applyMatrix4(F), V(Math.cos(b) * 0.123, 0.16, Math.sin(b) * 0.123).applyMatrix4(F), C.thread, 0.005); }
}
function train(k, F) {
  const P = (x, y, z) => F.clone().multiply(M([x, y, z]));
  k.solid(new THREE.BoxGeometry(0.36, 0.13, 0.15), P(0, 0.1, 0), C.green, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(0.14, 0.13, 0.15), P(-0.1, 0.23, 0), C.green, { batch: 'paint', smooth: false });
  k.solid(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12).rotateZ(Math.PI / 2), P(0.1, 0.19, 0), C.red, { batch: 'paint', smooth: false });
  k.solid(new THREE.CylinderGeometry(0.025, 0.03, 0.09, 8), P(0.15, 0.28, 0), C.ink, { batch: 'paint', smooth: false });
  for (const x of [-0.12, 0.0, 0.12]) for (const z of [-0.08, 0.08]) { const g = new THREE.CylinderGeometry(0.045, 0.045, 0.025, 12); g.rotateX(Math.PI / 2); k.solid(g, P(x, 0.045, z), z > 0 ? 0xe0b04a : 0xe0b04a, { batch: 'paint', smooth: false }); }
  k.solid(new THREE.BoxGeometry(0.26, 0.12, 0.14), P(-0.36, 0.1, 0), 0x3d6fb0, { batch: 'paint', smooth: false });
  for (const x of [-0.44, -0.28]) for (const z of [-0.075, 0.075]) { const g = new THREE.CylinderGeometry(0.04, 0.04, 0.025, 12); g.rotateX(Math.PI / 2); k.solid(g, P(x, 0.04, z), 0xe0b04a, { batch: 'paint', smooth: false }); }
}
function dollhouse(k, F) {
  k.solid(new THREE.BoxGeometry(0.26, 0.22, 0.18), F.clone().multiply(M([0, 0.11, 0])), 0xf0c9c0, { batch: 'paint', smooth: false });
  const roof = new THREE.CylinderGeometry(0.0, 0.2, 0.14, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, 0.75);
  k.solid(roof, F.clone().multiply(M([0, 0.29, 0])), C.red, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(0.06, 0.09, 0.01), F.clone().multiply(M([0, 0.045, 0.092])), C.ink, { batch: 'paint', smooth: false });
}

// ------------------------------------------------------------------ roofs
/** rows of felt shingles (scalloped strips), each row lifted and stitched along its top; batting snow over the top */
function feltRoof(k, F, { halfSpan, eaveH, pitch, zf, zb, ov = 0.35, rowH = 0.28, tile = 0.32, col = C.slate, col2 = C.slateL, snowTop = 0.5 }) {
  const c = Math.cos(pitch), s = Math.sin(pitch), run = halfSpan + ov, slopeLen = run / c, L = zf - zb, ridge = eaveH + halfSpan * Math.tan(pitch);
  for (const side of [1, -1]) {
    const P = F.clone().multiply(basis(V(side * run, eaveH - ov * Math.tan(pitch), side > 0 ? zf : zb), V(0, 0, side > 0 ? -1 : 1), V(-side * c, s, 0)));
    k.cut(rect(0, 0, L, slopeLen + 0.03), null, P, 0x2c2a3a, { t: 0.05, amp: 0, bevel: 0.01 });
    const rows = Math.ceil(slopeLen / rowH);
    for (let j = 0; j < rows; j++) {
      const y0 = j * rowH, h = rowH * 1.6, phase = (j % 2) * tile / 2, pts = [], n = Math.ceil((L + tile) / tile) + 1;
      for (let i = -1; i < n; i++) { const xa = i * tile + phase - tile / 2; for (let q = 0; q <= 6; q++) { const a = Math.PI + (q / 6) * Math.PI; pts.push([Math.min(L + 0.03, Math.max(-0.03, xa + tile / 2 + Math.cos(a) * tile / 2)), tile * 0.4 + Math.sin(a) * tile * 0.4]); } }
      const R = P.clone().multiply(M([0, y0, 0.05 + j * 0.0015], [-Math.atan2(0.05, h), 0, 0])).multiply(M([0, 0, 0.05]));
      k.cut([...pts, [L + 0.03, h], [-0.03, h]], null, R, (j * 7 + side) % 3 === 1 ? col2 : col, { t: 0.045, amp: 0.006, wave: 0.4, seg: 1 });
      k.S.running(R, [[0.1, tile * 0.7], [L - 0.1, tile * 0.7]], 0.046, C.threadD, { len: 0.07, gap: 0.05, r: 0.008 });
    }
    // cotton batting laid over the upper slope, patted down unevenly
    k.drape(P.clone().multiply(M([0, 0, 0.14])), -0.05, L + 0.05, slopeLen * (1 - snowTop) + 0.15 * Math.sin(side * 1.3), slopeLen + 0.02, { thick: 0.24, edge: 0.45, rag: 0.4, res: 0.12 });
  }
  // the ridge: a roll of batting
  const g = new THREE.CylinderGeometry(0.16, 0.16, L + 0.1, 10, 6); g.rotateX(Math.PI / 2);
  k.solid(g, F.clone().multiply(M([0, ridge + 0.1, (zf + zb) / 2])), C.white, { batch: 'batt' });
  return { ridge, heightAt: (x) => ridge - Math.abs(x) * Math.tan(pitch) };
}
/** a patchwork roof of stuffed calico shingles, quilted in rows */
function patchworkRoof(k, F, { halfSpan, eaveH, pitch, zf, zb, ov = 0.38, tile = 0.34, rowH = 0.27, snowTop = 0.45 }) {
  const c = Math.cos(pitch), s = Math.sin(pitch), run = halfSpan + ov, slopeLen = run / c, L = zf - zb, ridge = eaveH + halfSpan * Math.tan(pitch);
  for (const side of [1, -1]) {
    const P = F.clone().multiply(basis(V(side * run, eaveH - ov * Math.tan(pitch), side > 0 ? zf : zb), V(0, 0, side > 0 ? -1 : 1), V(-side * c, s, 0)));
    k.cut(rect(0, 0, L, slopeLen + 0.03), null, P, 0x5a2e2e, { batch: 'woven', t: 0.04, amp: 0, bevel: 0.01 });
    const rows = Math.ceil(slopeLen / rowH);
    for (let j = 0; j < rows; j++) {
      for (let x = -tile / 2 + (j % 2) * tile / 2; x < L; x += tile) {
        const a = Math.max(0, x), b = Math.min(L, x + tile); if (b - a < 0.08) continue;
        const R = P.clone().multiply(M([0, j * rowH, 0.05 + j * 0.002], [-0.16, 0, 0]));
        k.pillow(roundRect(a + 0.008, 0, b - 0.008, rowH * 1.45, 0.05), 0.03, R, C.calico[(k.r() * C.calico.length) | 0], { batch: 'print', extra: (k.r() * 4) | 0, rings: 2, flat: 4, under: 0.1, step: 0.12, amp: 0 });
      }
      k.S.running(P.clone().multiply(M([0, j * rowH + rowH * 0.95, 0.105 + j * 0.002])), [[0.08, 0], [L - 0.08, 0]], 0, C.cream, { len: 0.06, gap: 0.045, r: 0.008 });
    }
    k.drape(P.clone().multiply(M([0, 0, 0.12])), -0.05, L + 0.05, slopeLen * (1 - snowTop) + 0.1 * side, slopeLen + 0.02, { thick: 0.22, edge: 0.45, rag: 0.45, res: 0.12 });
  }
  const g = new THREE.CylinderGeometry(0.15, 0.15, L + 0.1, 10, 6); g.rotateX(Math.PI / 2);
  k.solid(g, F.clone().multiply(M([0, ridge + 0.08, (zf + zb) / 2])), C.white, { batch: 'batt' });
  return { ridge, heightAt: (x) => ridge - Math.abs(x) * Math.tan(pitch) };
}
/** crisp paper lace along a gable (a mixed-media touch: cut cardstock on fabric) */
function laceBarge(k, F, { halfSpan, eaveH, pitch, ov, z }) {
  const run = halfSpan + ov, c = Math.cos(pitch), s = Math.sin(pitch), len = run / c;
  for (const side of [1, -1]) {
    const o = V(side * run, eaveH - ov * Math.tan(pitch), z), u = V(-side * c, s, 0), v = side > 0 ? V(-s, -c, 0) : V(s, -c, 0);
    const P = F.clone().multiply(basis(o, u, v)).multiply(side > 0 ? new THREE.Matrix4() : new THREE.Matrix4().makeScale(1, 1, -1));
    const { outline, holes } = laceStrip(len, 0.26, { scallop: 0.24, depth: 0.55 });
    k.cut([[0, -0.05], ...outline.map(([x, y]) => [x, -y]).slice(1, -1), [len, -0.05]], holes.map((h) => h.map(([x, y]) => [x, -y])), P, C.card, { batch: 'card', t: 0.022, amp: 0.002 });
  }
}
function chimney(k, F, x, z, yRoof, yTop, smoke = false) {
  const w = 0.72, d = 0.8, y0 = yRoof - 0.6, h = yTop - y0;
  k.solid(new THREE.BoxGeometry(w, h, d, 1, 1, 1), F.clone().multiply(M([x, y0 + h / 2, z])), C.brick, { smooth: false });
  const P = F.clone().multiply(M([x, y0, z + d / 2 + 0.002]));
  for (let row = 0, y = 0.65; y < h - 0.1; row++, y += 0.13) {
    k.S.running(P, [[-w / 2 + 0.04, y], [w / 2 - 0.04, y]], 0, C.thread, { len: 0.05, gap: 0.03, r: 0.0065 });
    for (let bx = -w / 2 + (row % 2 ? 0.12 : 0.24); bx < w / 2 - 0.05; bx += 0.24) k.S.addLocal(P, [bx, y + 0.02, 0], [bx, y + 0.11, 0], C.thread, 0.0065);
  }
  k.solid(new THREE.BoxGeometry(w + 0.18, 0.14, d + 0.18), F.clone().multiply(M([x, yTop + 0.07, z])), C.stone, { batch: 'woven', smooth: false });
  k.lump(0.45, 0.13, 0.42, F.clone().multiply(M([x, yTop + 0.2, z])), C.white, { batch: 'batt', detail: 2, amp: 0.25, freq: 2.0 });
  if (smoke) for (let i = 0; i < 4; i++) { const t = i / 3; k.lump(0.18 + t * 0.22, 0.14 + t * 0.14, 0.16 + t * 0.18, F.clone().multiply(M([x + 0.12 + t * 0.8 + 0.1 * Math.sin(i * 2.1), yTop + 0.5 + t * 1.3, z - t * 0.3])), i % 2 ? 0xc4bec4 : 0xb5aeb6, { batch: 'batt', detail: 2, amp: 0.3, freq: 2.2 }); }
}
/** whipped seam down a wall's vertical corner: diagonal stitches wrapping the edge */
function cornerSeam(k, F, x, y0, y1, side) {
  for (let y = y0 + 0.05; y < y1 - 0.03; y += 0.085) {
    k.S.add(V(x - side * 0.035, y, TF + 0.002).applyMatrix4(F), V(x + side * 0.004, y + 0.05, TF * 0.5).applyMatrix4(F), C.thread, 0.009, V(0, 0, 1).transformDirection(F));
  }
}
/** layered felt letters: a red shadow layer and a cream top layer, each outlined in tiny running stitches */
function feltWord(k, F, word, h) {
  const w = h * 0.68, gap = h * 0.2, sw = h * 0.2; let x = -((word.length * (w + gap)) - gap) / 2;
  const shapes = {
    T: (x) => [[rect(x, h / 2 - sw, x + w, h / 2), null], [rect(x + w / 2 - sw / 2, -h / 2, x + w / 2 + sw / 2, h / 2 - sw + 0.005), null]],
    O: (x) => [[ellipse(x + w / 2, 0, w / 2, h / 2, 26), [ellipse(x + w / 2, 0, w / 2 - sw, h / 2 - sw, 22)]]],
    Y: (x) => [[[[x, h / 2], [x + sw * 1.1, h / 2], [x + w / 2, sw * 0.4], [x + w - sw * 1.1, h / 2], [x + w, h / 2], [x + w / 2 + sw / 2, -0.01], [x + w / 2 + sw / 2, -h / 2], [x + w / 2 - sw / 2, -h / 2], [x + w / 2 - sw / 2, -0.01]], null]],
    S: (x) => { const p = [], q = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t < 0.5 ? (0.1 + t * 2 * 1.45) * Math.PI : (0.55 - (t - 0.5) * 2 * 1.45) * Math.PI, cy = t < 0.5 ? h / 4 : -h / 4, r = h / 4; p.push([x + w / 2 + Math.cos(a) * (r + sw / 2) * 1.05, cy + Math.sin(a) * (r + sw / 2) * 0.98]); q.push([x + w / 2 + Math.cos(a) * (r - sw / 2) * 1.05, cy + Math.sin(a) * (r - sw / 2) * 0.98]); } return [[[...p, ...q.reverse()], null]]; },
  };
  for (const ch of word) {
    for (const [o, holes] of shapes[ch](x)) {
      k.cut(translate2(o, 0.025, -0.025), holes && holes.map((hh) => translate2(hh, 0.025, -0.025)), F, C.red, { t: 0.03, bevel: 0.01, amp: 0.004 });
      k.cut(o, holes, F.clone().multiply(M([0, 0, 0.03])), C.cream, { t: 0.03, bevel: 0.01, amp: 0.004 });
    }
    x += w + gap;
  }
}

// ------------------------------------------------------------------ the blue toy shop
export function shop(k) {
  const { W, D, H, pitch, plinth } = SHOP, hw = W / 2, ridge = SHOP.ridge;
  const Mb = M([SHOP.x, 0, SHOP.z]).multiply(lean(-0.006, 0.009));
  const F = (x = 0, y = 0, z = 0, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  const disp = (sx) => [sx * 1.65 - 0.68, 0.92, sx * 1.65 + 0.68, 2.3], up = (sx) => [sx * 1.35 - 0.42, 3.92, sx * 1.35 + 0.42, 4.95];
  const g = [-0.36, 5.75, 0.36, 6.82], dO = [DOOR.x - DOOR.w / 2, DOOR.y0, DOOR.x + DOOR.w / 2, DOOR.y0 + DOOR.h];
  // walls: four felt panels; openings cut out of the front; corners whip-stitched
  const front = [[-hw, 0], [hw, 0], [hw, H], [0, ridge], [-hw, H]];
  k.cut(front, [rect(...disp(-1)), rect(...disp(1)), rect(...dO), rect(...up(-1)), rect(...up(1)), arch(...g, 14)], Mb, C.blue, { amp: 0.014, wave: 0.6 });
  k.cut(front, null, F(0, 0, -D + TF), C.blue, { amp: 0.01, wave: 0.6 });
  for (const sx of [1, -1]) {
    const P = Mb.clone().multiply(basis(V(sx * (hw - (sx > 0 ? 0 : TF)), 0, sx > 0 ? -0.0 : -D), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    const holes = [rect(1.8, 3.9, 2.7, 4.95), rect(1.7, 1.0, 2.9, 2.2)].map((h) => (sx > 0 ? h : h.map(([x, y]) => [D - x, y])));
    k.cut(rect(0, 0, D, H), holes, P, C.blue, { amp: 0.012, wave: 0.6 });
    for (const hh of holes) { const xs = hh.map(([x]) => x), ys = hh.map(([, y]) => y); const [a, b, c2, d2] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; curtain(k, P, a, b, c2, d2, -0.04); cardFrame(k, P, a, b, c2, d2, TF, { border: 0.08 }); }
    cornerSeam(k, Mb, sx * hw, 0, H, sx);
  }
  // display windows (shadow boxes) and the upper windows (curtains, cardstock, embroidered shutters, planters)
  for (const sx of [-1, 1]) {
    displayBox(k, F(), ...disp(sx), sx);
    cardFrame(k, F(), ...disp(sx), TF, { rows: 2, cols: 2, bar: 0.035, border: 0.1 });
    k.solid(new THREE.BoxGeometry(1.62, 0.07, 0.2), F(sx * 1.65, 0.86, TF + 0.09), C.wood, { batch: 'paint', smooth: false });
    const [u0, v0, u1, v1] = up(sx);
    curtain(k, F(), u0, v0, u1, v1, -0.05);
    cardFrame(k, F(), u0, v0, u1, v1, TF, { border: 0.085 });
    shutter(k, F(), u0 - 0.17, v0 - 0.04, 0.38, v1 - v0 + 0.08, -1, 0.42, C.red, TF + 0.004);
    shutter(k, F(), u1 + 0.17, v0 - 0.04, 0.38, v1 - v0 + 0.08, 1, 0.38, C.red, TF + 0.004);
    planter(k, F(), (u0 + u1) / 2, v0 - 0.14, 1.0, TF);
  }
  curtain(k, F(), ...g, -0.05); cardFrame(k, F(), ...g, TF, { archTop: true, border: 0.08 });
  // cream felt pilasters, topstitched; a scalloped belt with French knots; paper lace under the gable
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.16);
    k.cut(rect(x - 0.15, plinth, x + 0.15, H - 0.12), null, F(0, 0, TF), C.cream, { t: 0.04, amp: 0.008 });
    for (const dx of [-0.1, 0.1]) k.S.running(F(0, 0, TF + 0.042), [[x + dx, plinth + 0.08], [x + dx, H - 0.2]], 0, C.threadD, { len: 0.06, gap: 0.045 });
  }
  const belt = [[-hw - 0.06, 0.12], [hw + 0.06, 0.12], [hw + 0.06, 0]]; const nb = 22;
  for (let i = nb; i >= 0; i--) { const x = -hw - 0.06 + (i / nb) * (W + 0.12); belt.push([x, i % 2 ? -0.07 : 0]); }
  k.cut(belt, null, F(0, 3.12, TF), C.cream, { t: 0.04, amp: 0.004 });
  for (let i = 1; i < nb; i += 2) k.S.knot(F(0, 3.12, TF + 0.045), -hw - 0.06 + (i / nb) * (W + 0.12), -0.035, 0, 0.018, C.red);
  const lace = laceStrip(W + 0.2, 0.24, { scallop: 0.26, depth: 0.6 });
  k.cut([[-hw - 0.1, 0.1], ...lace.outline.map(([x, y]) => [x - hw - 0.1, y]), [hw + 0.1, 0.1]].reverse(), lace.holes.map((h) => translate2(h, -hw - 0.1, 0)), F(0, H - 0.02, TF + 0.003), C.card, { batch: 'card', t: 0.022, amp: 0.002 });
  // the sign: a stuffed board of navy woven cotton, blanket-stitched in gold, with layered felt letters
  const SB = F(0, 3.5, TF + 0.03);
  k.pillow(roundRect(-1.32, -0.27, 1.32, 0.27, 0.07), 0.06, SB, C.blueD, { batch: 'woven', flat: 5, rings: 3 });
  k.S.blanket(SB, roundRect(-1.32, -0.27, 1.32, 0.27, 0.07), 0.035, C.gold, { step: 0.07, depth: 0.045, r: 0.008 });
  feltWord(k, SB.clone().multiply(M([0, 0, 0.05])), 'TOYS', 0.32);
  k.drape(SB.clone().multiply(M([0, 0.25, 0.0], [-Math.PI / 2, 0, 0])), -1.28, 1.28, -0.03, 0.12, { thick: 0.07, edge: 0.06, rag: 0.05, res: 0.08 });
  // plinth: tweed band and cut-felt stones
  k.cut(rect(-hw - 0.03, 0, hw + 0.03, plinth), null, F(0, 0, TF), 0x6f6a74, { batch: 'woven', t: 0.03, amp: 0.004 });
  for (let row = 0; row < 2; row++) { let x = -hw + row * 0.17; while (x < hw - 0.05) { const w = 0.3 + k.r() * 0.26, x1 = Math.min(hw, x + w); if (!(x1 > dO[0] - 0.05 && x < dO[2] + 0.05)) k.cut(roundRect(x + 0.02, row * 0.21 + 0.03, x1 - 0.02, row * 0.21 + 0.21, 0.05), null, F(0, 0, TF + 0.03), k.r() < 0.5 ? C.stone : 0xaaa3ac, { t: 0.035, amp: 0.01 }); x = x1; } }
  // door frame (cardstock), steps (stuffed tweed), the room behind the door (seen when it opens)
  const [d0, , d1, dt] = dO;
  k.cut([[d0 - 0.16, plinth], [d0, plinth], [d0, dt], [d1, dt], [d1, plinth], [d1 + 0.16, plinth], [d1 + 0.16, dt + 0.17], [d0 - 0.16, dt + 0.17]], null, F(0, 0, TF), C.card, { batch: 'card', t: 0.025, amp: 0.003 });
  k.cut(rect(d0 - 0.26, dt + 0.17, d1 + 0.26, dt + 0.26), null, F(0, 0, TF + 0.025), C.creamD, { batch: 'card', t: 0.025, amp: 0.002 });
  k.pillow(roundRect(-0.8, -0.28, 0.8, 0.28, 0.08), 0.1, F(0, 0.12, 0.3, [-Math.PI / 2, 0, 0]), 0x8f8994, { batch: 'woven', flat: 5, rings: 3 });
  k.pillow(roundRect(-0.65, -0.15, 0.65, 0.15, 0.06), 0.09, F(0, 0.33, 0.17, [-Math.PI / 2, 0, 0]), 0x9a949e, { batch: 'woven', flat: 5, rings: 3 });
  const iw = 1.9, idp = 3.0, y0 = plinth, ih = 2.5;
  k.cut(rect(-iw / 2, 0, iw / 2, idp), null, F(0, y0, 0, [-Math.PI / 2, 0, 0]), C.wood, { batch: 'paint', t: 0.03, amp: 0 });
  k.cut(rect(-iw / 2, 0, iw / 2, ih), null, F(0, y0, -idp), 0xe0c08a, { batch: 'print', t: 0.03, amp: 0, extra: 3 });
  for (const s of [1, -1]) k.cut(rect(-idp, 0, 0, ih), null, F(s * iw / 2, y0, 0, [0, -Math.PI / 2, 0]), 0xe0c08a, { batch: 'print', t: 0.03, amp: 0, extra: 3 });
  for (const sy of [0.9, 1.5]) { k.solid(new THREE.BoxGeometry(iw - 0.1, 0.05, 0.3), F(0, y0 + sy, -idp + 0.15), C.woodL, { batch: 'paint', smooth: false }); let x = -iw / 2 + 0.12; while (x < iw / 2 - 0.2) { const bw = 0.12 + k.r() * 0.12; k.solid(new THREE.BoxGeometry(bw, 0.12 + k.r() * 0.15, 0.14), F(x + bw / 2, y0 + sy + 0.1, -idp + 0.15), [C.red, 0x3d6fb0, C.green, 0xe0b04a][(k.r() * 4) | 0], { batch: 'paint', smooth: false }); x += bw + 0.05; } }
  teddy(k, F(0.5, y0 + 2.07, -idp + 0.2), 0.9);
  // awning, roof, chimney
  awning(k, Mb, -2.45, 2.45, 3.0, 1.1);
  const roof = feltRoof(k, Mb, { halfSpan: hw, eaveH: H, pitch, zf: 0.3, zb: -D - 0.3 });
  laceBarge(k, Mb, { halfSpan: hw, eaveH: H, pitch, ov: 0.35, z: 0.31 });
  chimney(k, Mb, 1.35, -2.4, roof.heightAt(1.35), 9.2, true);
  return { ridge };
}

/** a sewn awning: stripes of woven cotton seamed together, billowing slightly between the rods, a bound scalloped hem */
function awning(k, Mb, x0, x1, yTop, depth) {
  const n = 14, sw = (x1 - x0) / n, yFront = yTop - 0.42, nu = 4, nv = 10;
  for (let i = 0; i < n; i++) {
    const col = i % 2 ? C.cream : C.green, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let q = 0; q <= nu; q++) {
      const u = q / nu, v = j / nv, x = x0 + (i + u) * sw;
      const billow = 0.05 * Math.sin(v * Math.PI) + 0.012 * Math.sin(u * Math.PI);            // sags between the wall and the front rod
      pos.push(x, yTop + (yFront - yTop) * v - billow, TF + depth * v);
    }
    for (let j = 0; j < nv; j++) for (let q = 0; q < nu; q++) { const a = j * (nu + 1) + q; idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // give it a little thickness by adding a second, lower skin
    const g2 = g.clone(); g2.translate(0, -0.012, 0); const p2 = g2.index.array; for (let t = 0; t < p2.length; t += 3) { const tmp = p2[t + 1]; p2[t + 1] = p2[t + 2]; p2[t + 2] = tmp; } g2.computeVertexNormals();
    k.B.woven.add(g, Mb, col, { vary: 0.02 }); k.B.woven.add(g2, Mb, col, { vary: 0.02 });
    // the seam between stripes: a line of stitches down the fold
    if (i) for (let j = 0; j < nv; j++) { const v0 = (j + 0.2) / nv, v1 = (j + 0.75) / nv, x = x0 + i * sw, p = (v) => V(x, yTop + (yFront - yTop) * v - 0.05 * Math.sin(v * Math.PI) + 0.004, TF + depth * v).applyMatrix4(Mb); k.S.add(p(v0), p(v1), C.thread, 0.007); }
    // the valance: one scallop per stripe, hanging from the front rod, bound in green bias tape
    const tab = [[0, 0], [sw, 0], [sw, -0.16]]; for (let q = 0; q <= 10; q++) { const a = (q / 10) * Math.PI; tab.push([sw / 2 + Math.cos(a) * sw / 2, -0.16 - Math.sin(a) * 0.15]); } tab.push([0, -0.16]);
    const T2 = Mb.clone().multiply(M([x0 + i * sw, yFront - 0.01, TF + depth + 0.005], [0.06 * Math.sin(i * 1.7), 0, 0]));
    k.cut(tab, null, T2, col, { batch: 'woven', t: 0.018, bevel: 0.006, amp: 0.003 });
    const bind = []; for (let q = 0; q <= 10; q++) { const a = (q / 10) * Math.PI; bind.push([sw / 2 + Math.cos(a) * (sw / 2 + 0.012), -0.16 - Math.sin(a) * 0.162]); }
    for (let q = 0; q < 10; q++) { const [ax, ay] = bind[q], [bx, by] = bind[q + 1]; k.S.add(V(ax, ay, 0.02).applyMatrix4(T2), V(bx, by, 0.02).applyMatrix4(T2), C.greenD, 0.013); }
  }
  // the front rod: a painted wooden dowel with turned ends
  const rod = new THREE.CylinderGeometry(0.03, 0.03, x1 - x0 + 0.16, 10); rod.rotateZ(Math.PI / 2);
  k.solid(rod, Mb.clone().multiply(M([(x0 + x1) / 2, yFront + 0.01, TF + depth])), C.greenD, { batch: 'paint', smooth: false });
  for (const x of [x0 - 0.1, x1 + 0.1]) k.solid(new THREE.SphereGeometry(0.05, 10, 8), Mb.clone().multiply(M([x, yFront + 0.01, TF + depth])), C.gold, { batch: 'paint' });
  for (const x of [x0, x1]) k.cut([[0, yTop], [depth, yFront], [depth, yFront - 0.1], [0.25, yTop - 0.4]], null, Mb.clone().multiply(basis(V(x + (x > 0 ? -0.02 : 0.02), 0, TF), V(0, 0, 1), V(0, 1, 0))), C.green, { batch: 'woven', t: 0.018, amp: 0.003 });
  for (const [u, v, s] of [[0.9, 0.45, 1.0], [2.6, 0.62, 0.7], [3.9, 0.38, 0.85]]) k.lump(0.26 * s, 0.2 * s, 0.13 * s, Mb.clone().multiply(basis(V(x0, yTop - 0.02, TF + 0.02), V(1, 0, 0), V(0, yFront - yTop, depth))).multiply(M([u, v * 1.18, 0.05])), C.white, { batch: 'batt', detail: 2, amp: 0.3, freq: 2.2 });
}

// ------------------------------------------------------------------ the pink house: woven cotton walls, quilted below, a patchwork roof
export function pinkHouse(k) {
  const { W, D, H, pitch, plinth } = PINK, hw = W / 2;
  const Mb = M([PINK.x, 0, PINK.z]).multiply(lean(0.005, -0.012));
  const F = (x = 0, y = 0, z = 0, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  const ups = [[-1.35, 2.65, -0.55, 3.55], [0.55, 2.65, 1.35, 3.55]], dO = [0.81, plinth, 1.69, plinth + 1.95], bay = [-1.45, 0.85, -0.15, 2.05];
  const box = rect(-hw, 0, hw, H);
  k.cut(box, [...ups.map((u) => rect(...u)), arch(...dO, 12)], Mb, C.pink, { batch: 'woven', t: 0.05, amp: 0.012, wave: 0.6 });
  k.cut(box, null, F(0, 0, -D + 0.05), C.pink, { batch: 'woven', t: 0.05, amp: 0.01 });
  const gable = [[0, 0], [D, 0], [D, H], [D / 2, PINK.ridge], [0, H]];
  for (const sx of [1, -1]) {
    const P = Mb.clone().multiply(basis(V(sx * (hw - (sx > 0 ? 0 : 0.05)), 0, sx > 0 ? 0 : -D), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    const hole = arch(D / 2 - 0.33, 3.95, D / 2 + 0.33, 4.8, 12);
    k.cut(gable, [hole], P, C.pink, { batch: 'woven', t: 0.05, amp: 0.012, wave: 0.6 });
    curtain(k, P, D / 2 - 0.33, 3.95, D / 2 + 0.33, 4.8, -0.04); cardFrame(k, P, D / 2 - 0.33, 3.95, D / 2 + 0.33, 4.8, 0.05, { archTop: true, border: 0.07 });
    cornerSeam(k, Mb, sx * hw, 0, H, sx);
  }
  // quilting below the windows: a diamond grid of running stitches, the cloth puffed between
  const qz = 0.052;
  for (let d = -6; d <= 6; d++) {
    const pts = []; for (let t = 0; t <= 1; t += 0.5) pts.push([d * 0.42 + t * 2.3 - 1.15, plinth + 0.08 + t * 1.9]);
    const clip = (p) => p.filter(([x, y]) => x > -hw + 0.12 && x < hw - 0.12 && y < 2.4 && !(x > bay[0] - 0.08 && x < bay[2] + 0.08) && !(x > dO[0] - 0.1 && x < dO[2] + 0.1));
    for (const sgn of [1, -1]) { const seg = clip(pts.map(([x, y]) => [sgn * x, y])); if (seg.length >= 2) k.S.running(F(), seg, qz, 0xb8706c, { len: 0.06, gap: 0.04, r: 0.007 }); }
  }
  for (const [u0, v0, u1, v1] of ups) {
    curtain(k, F(), u0, v0, u1, v1, -0.04); cardFrame(k, F(), u0, v0, u1, v1, 0.05, { border: 0.08 });
    shutter(k, F(), u0 - 0.16, v0 - 0.03, 0.34, v1 - v0 + 0.06, -1, 0.35, C.sage, 0.054);
    shutter(k, F(), u1 + 0.16, v0 - 0.03, 0.34, v1 - v0 + 0.06, 1, 0.42, C.sage, 0.054);
    planter(k, F(), (u0 + u1) / 2, v0 - 0.13, 0.92, 0.05);
  }
  // door: plum felt with appliqué panels, a glowing fanlight, a wooden knob, a thread-wrapped wreath
  k.cut(arch(dO[0] + 0.01, dO[1], dO[2] - 0.01, dO[3], 14), [arch(dO[0] + 0.12, dO[3] - 0.46, dO[2] - 0.12, dO[3] - 0.1, 10)], F(0, 0, -0.02), C.plum, { t: TF, amp: 0.004 });
  curtain(k, F(), dO[0] + 0.12, dO[3] - 0.46, dO[2] - 0.12, dO[3] - 0.1, -0.04);
  for (const yy of [0.25, 0.85]) for (const xx of [-0.2, 0.2]) { const o = roundRect(1.25 + xx - 0.14, plinth + yy, 1.25 + xx + 0.14, plinth + yy + 0.48, 0.04); k.cut(o, null, F(0, 0, -0.02 + TF), 0x6e1f28, { t: 0.025, bevel: 0.008, amp: 0.003 }); }
  k.cut(arch(dO[0] - 0.13, dO[1], dO[2] + 0.13, dO[3] + 0.13, 16), [arch(...dO, 14)], F(0, 0, 0.05), C.card, { batch: 'card', t: 0.025, amp: 0.002 });
  k.solid(new THREE.SphereGeometry(0.045, 10, 8), F(0.97, plinth + 0.95, 0.09), C.gold, { batch: 'paint' });
  wreath(k, F(1.25, plinth + 1.32, 0.1));
  k.pillow(roundRect(-0.62, -0.24, 0.62, 0.24, 0.08), 0.1, F(1.25, 0.1, 0.25, [-Math.PI / 2, 0, 0]), 0x948e98, { batch: 'woven', flat: 5, rings: 3 });
  // bay window: a stuffed bay of the same pink cloth with cardstock frames and curtains
  const bx = -0.8, bw = 1.3, bd = 0.5;
  k.pillow(roundRect(-bw / 2, -1.12, bw / 2, 1.12, 0.12), bd * 0.5, F(bx, 1.12, 0.05), C.pink, { batch: 'woven', flat: 6, rings: 4, under: 0.02 });
  curtain(k, F(0, 0, 0.05 + bd * 0.5 + 0.02), bx - 0.45, 1.0, bx + 0.45, 1.95, 0.0);
  cardFrame(k, F(0, 0, 0.05 + bd * 0.5 + 0.02), bx - 0.45, 1.0, bx + 0.45, 1.95, 0.0, { rows: 2, cols: 3, border: 0.07 });
  k.solid(new THREE.BoxGeometry(bw + 0.2, 0.08, bd + 0.2), F(bx, 2.28, bd / 2 + 0.05), C.roofR || 0x9e4636, { batch: 'paint', smooth: false });
  k.drape(F(bx, 2.33, bd / 2 + 0.05, [-Math.PI / 2, 0, 0]), -bw / 2 - 0.05, bw / 2 + 0.05, -bd / 2 - 0.1, bd / 2 + 0.1, { thick: 0.08, edge: 0.12, rag: 0.1, res: 0.08 });
  // eave lace (paper), corner boards (felt), plinth (tweed)
  const lace = laceStrip(W + 0.5, 0.28, { scallop: 0.24, depth: 0.55 });
  k.cut([[-hw - 0.25, 0.1], ...lace.outline.map(([x, y]) => [x - hw - 0.25, y]), [hw + 0.25, 0.1]].reverse(), lace.holes.map((h) => translate2(h, -hw - 0.25, 0)), F(0, H - 0.04, 0.36), C.card, { batch: 'card', t: 0.022, amp: 0.002 });
  for (const sx of [-1, 1]) k.cut(rect(sx > 0 ? hw - 0.14 : -hw, plinth, sx > 0 ? hw : -hw + 0.14, H), null, F(0, 0, 0.05), C.cream, { t: 0.04, amp: 0.006 });
  k.cut(rect(-hw - 0.03, 0, hw + 0.03, plinth), null, F(0, 0, 0.05), 0x7d7069, { batch: 'woven', t: 0.03, amp: 0.004 });
  const R = Mb.clone().multiply(M([0, 0, -D / 2], [0, Math.PI / 2, 0]));
  const roof = patchworkRoof(k, R, { halfSpan: D / 2, eaveH: H, pitch, zf: hw + 0.32, zb: -hw - 0.32 });
  chimney(k, R, -0.9, -1.0, roof.heightAt(-0.9), PINK.ridge + 0.9);
}

/** a wreath of thread-wrapped wire: a ring wound with green floss, felt holly, a fabric bow */
export function wreath(k, F, s = 1) {
  const ring = new THREE.TorusGeometry(0.17 * s, 0.035 * s, 8, 26);
  k.solid(ring, F.clone(), 0x2f6a3e, { batch: 'woven' });
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU, b = a + 0.12; const p = (aa, r0) => V(Math.cos(aa) * (0.17 * s + r0), Math.sin(aa) * (0.17 * s + r0), 0).applyMatrix4(F);
    k.S.add(p(a, -0.036 * s), p(b, 0.036 * s), 0x3e8a50, 0.009 * s, V(0, 0, 1).transformDirection(F)); }
  for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.32; holly(k, F.clone().multiply(M([Math.cos(a + Math.PI) * 0.17 * s, Math.sin(a + Math.PI) * 0.17 * s, 0.03 * s], [0, 0, a + Math.PI / 2])), 2, 0.7 * s); }
  bow(k, F.clone().multiply(M([0, -0.18 * s, 0.05 * s])), C.berry, 0.9 * s);
}
/** a fabric bow: two stuffed loops, a knot and two notched tails */
export function bow(k, F, col, s = 1) {
  for (const sd of [-1, 1]) {
    const loop = new THREE.TorusGeometry(0.055 * s, 0.018 * s, 8, 16); loop.scale(1.25, 0.75, 0.55);
    k.solid(loop, F.clone().multiply(M([sd * 0.06 * s, 0.01 * s, 0], [0, 0, sd * 0.25])), col, { batch: 'woven' });
    k.cut([[-0.018 * s, 0], [0.018 * s, 0], [0.022 * s, -0.12 * s], [0, -0.1 * s], [-0.022 * s, -0.12 * s]], null, F.clone().multiply(M([sd * 0.025 * s, -0.01 * s, -0.005], [0, 0, sd * 0.35])), col, { batch: 'woven', t: 0.008, bevel: 0.003, amp: 0 });
  }
  k.solid(new THREE.SphereGeometry(0.025 * s, 8, 6), F.clone().multiply(M([0, 0.005 * s, 0.01 * s])), col, { batch: 'woven' });
}
