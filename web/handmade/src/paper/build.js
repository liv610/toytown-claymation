// Experiment A — paper-cut storybook: the two buildings.
//
// Construction rules (what a paper engineer would actually do):
//   * every part is a piece of card ~0.8 mm thick at model scale (T = 3 cm in world units), cut by hand;
//   * openings are really cut out of the wall, with lit vellum glued behind;
//   * decoration is layered: wall → frame → moulding → shutters, each a card thickness or a spacer in front,
//     so every layer throws a thin shadow on the one behind;
//   * roofs are rows of scalloped tiles, each row lifted at its lower edge so it overlaps the one below;
//   * boxes (steps, sills, planters, the chimney, presents) are folded from card: separate faces, open behind.
import * as THREE from 'three';
import { Batch, slab, bend, handCut, rect, roundRect, circle, arch, star, ellipse, rng, M, basis, V, translate2, TAU } from '../kit.js';
import { SHOP, PINK, DOOR } from '../layout.js';

export const T = 0.03;                     // card thickness in world units
export const C = {
  blue: 0x3d6fb0, blueD: 0x2b4f86, cream: 0xefe1c2, creamD: 0xdcc9a3, red: 0xa8322f, green: 0x2f7a4c, greenL: 0x4c9a64,
  slate: 0x4a4862, slateL: 0x5d5a78, stone: 0x9a949c, stoneD: 0x6f6a74, brick: 0xa2493a, brickD: 0x7e3428, gold: 0xd9a441,
  doorG: 0x3f6f57, pink: 0xe2938e, pinkD: 0xc87672, sage: 0x5f8a6e, plum: 0x8a2228, roofR: 0x9c4434, roofRL: 0xb5573f,
  white: 0xfbf8f1, kraft: 0xb08a5e, wood: 0x7a4b2a, ink: 0x2a2228, holly: 0x2e6b3e, berry: 0xc0262c,
};

export function makeKit(seed = 7) {
  const r = rng(seed);
  const B = { card: new Batch('card', seed), foil: new Batch('foil', seed + 1), vellum: new Batch('vellum', seed + 2) };
  const sd = () => (r() * 1e6) | 0;
  /** cut a piece: outline (+ holes), thickness t, placed by matrix */
  function cut(outline, holes, matrix, color, { t = T, amp = 0.006, wave = 0.3, tear = 0, tearWave = 0.03, hamp = 0.004, batch = 'card', vary = 0.04, extra = 0, centre = false, curl = null } = {}) {
    const o = amp || tear ? handCut(outline, { amp, wave, tear, tearWave, seed: sd() }) : outline;
    const hs = (holes || []).map((h) => (hamp ? handCut(h, { amp: hamp, wave: 0.18, seed: sd() }) : h));
    const g = slab(o, hs, t, { center: centre }); if (curl) bend(g, curl[0], curl[1] || 0, curl[2] || 0, curl[3] || 0);
    return B[batch].add(g, matrix, color, { vary, extra });
  }
  /** a box folded from card: top + 4 sides (open bottom), outer size w × h × d, base centred at origin */
  function cardBox(w, h, d, matrix, color, { t = T, top = true, back = true, batch = 'card', amp = 0.003 } = {}) {
    const hw = w / 2, hd = d / 2, o = { t, batch, amp, wave: 0.25, vary: 0.02 };
    const col = color;
    cut(rect(-hw, 0, hw, h), null, matrix.clone().multiply(M([0, 0, hd - t])), col, o);                                   // front
    if (back) cut(rect(-hw, 0, hw, h), null, matrix.clone().multiply(M([0, 0, -hd], [0, 0, 0]).multiply(M([0, 0, 0]))), col, o);
    cut(rect(-hd, 0, hd, h), null, matrix.clone().multiply(M([hw - t, 0, 0], [0, Math.PI / 2, 0])), col, o);             // right
    cut(rect(-hd, 0, hd, h), null, matrix.clone().multiply(M([-hw, 0, 0], [0, Math.PI / 2, 0])), col, o);                // left
    if (top) cut(rect(-hw, -hd, hw, hd), null, matrix.clone().multiply(M([0, h - t, 0], [-Math.PI / 2, 0, 0])), col, o);  // lid
  }
  return { r, B, cut, cardBox, sd };
}

// ------------------------------------------------------------------ reusable paper parts (in a facade's local frame: x across, y up, z out)
/** a window frame cut from one card, panes as holes; a second, wider moulding card behind it; and a sill */
function windowFrame(k, F, x0, y0, x1, y1, { rows = 2, cols = 2, bar = 0.05, border = 0.11, col = C.cream, sill = true, archTop = false, z = T } = {}) {
  const panes = [], pw = (x1 - x0 - bar * (cols - 1)) / cols, ph = (y1 - y0 - bar * (rows - 1)) / rows;
  if (archTop) panes.push(arch(x0, y0, x1, y1, 14));
  else for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) panes.push(rect(x0 + i * (pw + bar), y0 + j * (ph + bar), x0 + i * (pw + bar) + pw, y0 + j * (ph + bar) + ph));
  const outer = archTop ? arch(x0 - border, y0 - border, x1 + border, y1 + border, 16) : rect(x0 - border, y0 - border, x1 + border, y1 + border);
  k.cut(outer, panes, F.clone().multiply(M([0, 0, z + 0.004])), col);
  if (archTop) {   // glazing bars across the arch (cut as a separate cross)
    const cx = (x0 + x1) / 2, cy = y0 + (y1 - y0) * 0.45;
    k.cut(rect(cx - bar / 2, y0, cx + bar / 2, y1), null, F.clone().multiply(M([0, 0, z + 0.004])), col, { amp: 0.002 });
    k.cut(rect(x0, cy - bar / 2, x1, cy + bar / 2), null, F.clone().multiply(M([0, 0, z + 0.004])), col, { amp: 0.002 });
  }
  // moulding behind: wider and slightly darker, so the frame steps out of the wall in two layers
  const b2 = border + 0.07;
  const mould = archTop ? arch(x0 - b2, y0 - b2, x1 + b2, y1 + b2, 16) : rect(x0 - b2, y0 - b2, x1 + b2, y1 + b2);
  k.cut(mould, [archTop ? arch(x0 - border + 0.03, y0 - border + 0.03, x1 + border - 0.03, y1 + border - 0.03, 16) : rect(x0 - border + 0.03, y0 - border + 0.03, x1 + border - 0.03, y1 + border - 0.03)],
    F.clone().multiply(M([0, 0, z])), C.creamD);
  if (sill) {     // folded sill: a ledge and its front lip
    const sw = (x1 - x0) / 2 + b2 + 0.06, cx = (x0 + x1) / 2;
    k.cut(rect(cx - sw, 0, cx + sw, 0.16), null, F.clone().multiply(M([0, y0 - b2, z], [Math.PI / 2, 0, 0])), col, { amp: 0.002 });
    k.cut(rect(cx - sw, -0.07, cx + sw, 0), null, F.clone().multiply(M([0, y0 - b2, z + 0.16])), col, { amp: 0.002 });
  }
}
/** the lit inside of an opening: four reveal strips going back into the wall and a vellum pane */
function lightBox(k, F, x0, y0, x1, y1, depth, { glow = 0xffc77a, revealCol = C.creamD, extra = 0, archTop = false } = {}) {
  const w = x1 - x0, h = y1 - y0, o = { amp: 0.002 };
  k.cut(rect(0, -depth, w, 0), null, F.clone().multiply(M([x0, y0, 0], [Math.PI / 2, 0, 0])), revealCol, o);                // floor
  if (!archTop) k.cut(rect(0, -depth, w, 0), null, F.clone().multiply(M([x0, y1 + T, 0], [Math.PI / 2, 0, 0])), revealCol, o);
  k.cut(rect(-depth, 0, 0, h), null, F.clone().multiply(M([x0 - T, y0, 0], [0, -Math.PI / 2, 0])), revealCol, o);
  k.cut(rect(-depth, 0, 0, h), null, F.clone().multiply(M([x1, y0, 0], [0, -Math.PI / 2, 0])), revealCol, o);
  const pad = 0.06, pane = archTop ? arch(x0 - pad, y0 - pad, x1 + pad, y1 + pad, 14) : rect(x0 - pad, y0 - pad, x1 + pad, y1 + pad);
  k.cut(pane, null, F.clone().multiply(M([0, 0, -depth - T])), glow, { batch: 'vellum', amp: 0.004, extra, vary: 0.02 });
}
/** a louvred shutter, hinged at x = hingeX, opened by `open` radians, cut with slits and a little heart */
function shutter(k, F, hingeX, y0, w, h, side, open, col) {
  const pivot = F.clone().multiply(M([hingeX, y0, T * 2.2], [0, -side * open, 0]));
  const holes = [];
  const n = Math.floor((h * 0.62) / 0.09);
  for (let i = 0; i < n; i++) { const y = h - 0.12 - i * 0.09; holes.push(rect(0.07, y - 0.035, w - 0.07, y)); }
  const hy = h * 0.2, hx = w / 2;                                    // heart: two circles and a point
  const heart = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.95 - i / 10 * Math.PI * 1.25; heart.push([hx - 0.045 + Math.cos(a) * 0.045, hy + 0.03 + Math.sin(a) * 0.045]); }
  heart.push([hx, hy - 0.08]);
  for (let i = 0; i <= 10; i++) { const a = -Math.PI * 0.3 + i / 10 * Math.PI * 1.25; heart.push([hx + 0.045 + Math.cos(a) * 0.045, hy + 0.03 + Math.sin(a) * 0.045]); }
  holes.push(heart);
  const outline = side > 0 ? rect(0, 0, w, h) : rect(-w, 0, 0, h);
  k.cut(outline, holes.map((p) => (side > 0 ? p : p.map(([x, y]) => [x - w, y]))), pivot, col, { hamp: 0.002 });
  // a narrow frame strip on the shutter's face (second layer)
  const fx0 = side > 0 ? 0 : -w;
  k.cut(rect(fx0, 0, fx0 + w, 0.05), null, pivot.clone().multiply(M([0, 0, T])), col, { amp: 0.002 });
  k.cut(rect(fx0, h - 0.05, fx0 + w, h), null, pivot.clone().multiply(M([0, 0, T])), col, { amp: 0.002 });
}
/** a holly sprig: serrated leaves fanned out, berries punched from red card */
export function holly(k, Mx, n = 5, s = 1) {
  for (let i = 0; i < n; i++) {
    const a = -0.9 + (i / Math.max(1, n - 1)) * 1.8 + (k.r() - 0.5) * 0.3, L = (0.22 + k.r() * 0.08) * s, wd = 0.07 * s;
    const leaf = []; const m = 7;
    for (let j = 0; j <= m; j++) { const t = j / m, y = t * L, ww = Math.sin(t * Math.PI) * wd * (j % 2 ? 1.25 : 0.85); leaf.push([ww, y]); }
    for (let j = m - 1; j > 0; j--) { const t = j / m, y = t * L, ww = Math.sin(t * Math.PI) * wd * (j % 2 ? 1.25 : 0.85); leaf.push([-ww, y]); }
    k.cut(leaf, null, Mx.clone().multiply(M([0, 0, 0], [0.35 + k.r() * 0.4, (k.r() - 0.5) * 0.6, a])), k.r() < 0.5 ? C.holly : C.green, { t: T * 0.8, amp: 0.002, vary: 0.08 });
  }
  for (let i = 0; i < 3; i++) k.cut(circle(0, 0, 0.035 * s, 10), null, Mx.clone().multiply(M([(i - 1) * 0.045 * s, 0.03 * s + (i % 2) * 0.03 * s, 0.06 * s])), C.berry, { t: T * 0.8, amp: 0.002 });
}
/** a planter box folded from card, with holly */
function windowBox(k, F, cx, y, w) {
  k.cardBox(w, 0.2, 0.22, F.clone().multiply(M([cx, y - 0.2, 0.11 + T])), C.red, { amp: 0.002 });
  // scalloped top edge strip on the front face
  const sc = []; const n = Math.round(w / 0.12);
  for (let i = 0; i <= n * 4; i++) { const t = i / (n * 4), x = -w / 2 + t * w; sc.push([x, 0.045 * Math.abs(Math.sin(t * n * Math.PI))]); }
  sc.push([w / 2, -0.02], [-w / 2, -0.02]);
  k.cut(sc, null, F.clone().multiply(M([cx, y - 0.06, 0.22 + T * 1.2])), C.cream, { amp: 0.002 });
  for (let i = 0; i < 3; i++) holly(k, F.clone().multiply(M([cx - w / 3 + i * w / 3, y - 0.02, 0.12])), 5, 0.95);
}
/** a strip with a scalloped / lace lower edge (eave lace, bargeboards, awning valances), length L along x, drop h */
export function laceStrip(L, h, { scallop = 0.22, depth = 0.6, holes = true, x0 = 0 } = {}) {
  const pts = [[x0, 0]]; const n = Math.max(1, Math.round(L / scallop)), sw = L / n, hs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= 8; j++) { const a = Math.PI - (j / 8) * Math.PI; pts.push([x0 + i * sw + sw / 2 + Math.cos(a) * sw / 2, -h + (1 - depth) * h * 0 - Math.sin(a) * h * depth * 0.5 - h * (1 - depth) * 0]); }
    if (holes && sw > 0.12) hs.push(circle(x0 + i * sw + sw / 2, -h * 0.42, Math.min(sw, h) * 0.17, 10));
  }
  pts.push([x0 + L, 0]);
  return { outline: pts.reverse(), holes: hs };
}

// ------------------------------------------------------------------ roofs
/**
 * A pitched roof of scalloped tile rows, built in a canonical frame: ridge along local z, slopes falling to ±x.
 * F maps the canonical frame to the world (building origin at ground level).
 */
function tiledRoof(k, F, { halfSpan, eaveH, pitch, zf, zb, ov = 0.35, rowH = 0.24, tile = 0.28, col = C.slate, col2 = C.slateL, shape = 'scallop', snowTop = 0.55 }) {
  const c = Math.cos(pitch), s = Math.sin(pitch), run = halfSpan + ov, slopeLen = run / c, L = zf - zb;
  const ridge = eaveH + halfSpan * Math.tan(pitch);
  const eaveY = eaveH - ov * Math.tan(pitch);
  for (const side of [1, -1]) {
    // canonical plane: origin at the eave's front corner, local x along the ridge (front→back for side=+1), local y up the slope
    const o = V(side * run, eaveY, side > 0 ? zf : zb), u = V(0, 0, side > 0 ? -1 : 1), v = V(-side * c, s, 0);
    const P = F.clone().multiply(basis(o, u, v));
    // sarking board under the tiles (dark card), and a drip edge
    k.cut(rect(0, 0, L, slopeLen + 0.02), null, P, 0x2e2b3a, { amp: 0.003 });
    const rows = Math.ceil(slopeLen / rowH);
    for (let j = 0; j < rows; j++) {
      const y0 = j * rowH - 0.04, h = rowH * 1.75, phase = (j % 2) * tile / 2, pts = [];
      // bottom edge (scalloped or square-cut tabs), left → right
      const n = Math.ceil((L + tile) / tile) + 1;
      for (let i = -1; i < n; i++) {
        const xa = i * tile + phase - tile / 2;
        if (shape === 'scallop') { for (let q = 0; q <= 10; q++) { const a = Math.PI + (q / 10) * Math.PI; pts.push([xa + tile / 2 + Math.cos(a) * tile / 2, tile * 0.42 + Math.sin(a) * tile * 0.42]); } }
        else { const g = 0.022; pts.push([xa + g, tile * 0.25], [xa + g + 0.02, 0], [xa + tile - g - 0.02, 0], [xa + tile - g, tile * 0.25]); }
      }
      const clipX = (x) => Math.min(L + 0.03, Math.max(-0.03, x));
      const edge = pts.map(([x, y]) => [clipX(x), y]);
      const outline = [...edge, [L + 0.03, h], [-0.03, h]];
      const lift = 0.05, tilt = -Math.atan2(lift, h);
      const rowCol = (j % 3 === 1) ? col2 : col;
      k.cut(outline, null, P.clone().multiply(M([0, y0, T * 1.2 + j * 0.0015], [tilt, 0, 0])).multiply(M([0, 0, lift])), rowCol, { amp: 0.004, wave: 0.5, vary: 0.06 });
    }
    // snow: torn sheets over the upper slope, a second smaller layer, and a lacy drip line at the eave
    const topStart = slopeLen * (1 - snowTop);
    const sheet = []; const m = 28;
    for (let i = 0; i <= m; i++) { const t = i / m, x = t * L; sheet.push([x, topStart + 0.25 * Math.sin(t * 9.0 + side) + 0.18 * Math.sin(t * 23.0 + 1.3 * side) + 0.12 * k.r()]); }
    sheet.push([L + 0.05, slopeLen + 0.06], [-0.05, slopeLen + 0.06]);
    k.cut(sheet, null, P.clone().multiply(M([0, 0, T * 2.6 + 0.07])), C.white, { tear: 0.025, tearWave: 0.06, amp: 0.02, wave: 0.5, vary: 0.01 });
    const sheet2 = sheet.map(([x, y]) => [x, y < slopeLen ? y + 0.3 + 0.1 * Math.sin(x * 5.0) : y]);
    k.cut(sheet2, null, P.clone().multiply(M([0, 0, T * 3.8 + 0.07])), 0xf4f1ea, { tear: 0.02, tearWave: 0.05, amp: 0.02, wave: 0.4, vary: 0.01 });
    // a few windblown scraps lower down
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + k.r() * (L - 1.2), y = topStart * (0.45 + k.r() * 0.4), rr = 0.1 + k.r() * 0.1, pts = [];
      for (let q = 0; q < 9; q++) { const a = (q / 9) * TAU; pts.push([Math.cos(a) * rr * (2.2 + 0.9 * Math.sin(q * 2.3)), Math.sin(a) * rr * (0.7 + 0.4 * Math.cos(q * 1.7))]); }
      k.cut(pts, null, P.clone().multiply(M([x, y, T * 2.6 + 0.06], [0, 0, (k.r() - 0.5) * 0.3])), C.white, { tear: 0.014, tearWave: 0.04, amp: 0.015 });
    }
    // icicle-like drips cut along the eave
    const drip = [[0, 0.08]]; const nd = Math.round(L / 0.14);
    for (let i = 0; i <= nd; i++) { const x = (i / nd) * L; drip.push([x, (i % 2 ? -0.03 - 0.1 * k.r() : 0.02)]); }
    drip.push([L, 0.08]);
    k.cut(drip.reverse(), null, P.clone().multiply(M([0, -0.02, T * 2.6 + 0.04])), C.white, { amp: 0.004 });
  }
  // ridge: a folded cap of snow card along the top
  for (const side of [1, -1]) {
    const o = V(0, ridge + 0.03, zf + 0.05), u = V(0, 0, -1), v = V(side * c, -s, 0);
    k.cut(rect(0, -0.02, L + 0.1, 0.32), null, F.clone().multiply(basis(o, u, v)).multiply(M([0, 0, T * 4 + 0.05])), C.white, { tear: 0.012, tearWave: 0.05, amp: 0.01 });
  }
  return { ridge, eaveY, heightAt: (x) => ridge - Math.abs(x) * Math.tan(pitch) };
}

/** scalloped bargeboard along a gable slope, in a facade frame F (gable apex at (0, ridge)) */
function bargeboards(k, F, { halfSpan, eaveH, pitch, ov, z, col = C.cream }) {
  const ridge = eaveH + halfSpan * Math.tan(pitch), run = halfSpan + ov, c = Math.cos(pitch), s = Math.sin(pitch), len = run / c;
  for (const side of [1, -1]) {
    const o = V(side * run, eaveH - ov * Math.tan(pitch), z), u = V(-side * c, s, 0), v = side > 0 ? V(-s, -c, 0) : V(s, -c, 0);
    const P = F.clone().multiply(basis(o, side > 0 ? u : u, v)).multiply(side > 0 ? new THREE.Matrix4() : new THREE.Matrix4().makeScale(1, 1, -1));
    const { outline, holes } = laceStrip(len, 0.3, { scallop: 0.26, depth: 0.55 });
    const flipped = outline.map(([x, y]) => [x, -y]), fh = holes.map((h) => h.map(([x, y]) => [x, -y]));
    k.cut([[0, -0.06], ...flipped.slice(1, -1), [len, -0.06]], fh, P, col, { amp: 0.003 });
  }
}

// ------------------------------------------------------------------ walls
/** four card walls (front and back with the gable when gableFront), openings cut in the front */
function walls(k, Mb, { W, D, H, ridge, gableFront, frontHoles = [], sideHoles = [], col }) {
  const hw = W / 2, hd = D;
  const gable = [[-hw, 0], [hw, 0], [hw, H], [0, ridge], [-hw, H]], box = rect(-hw, 0, hw, H);
  k.cut(gableFront ? gable : box, frontHoles, Mb, col, { amp: 0.004, wave: 0.6 });
  k.cut(gableFront ? gable : box, null, Mb.clone().multiply(M([0, 0, -D + T])), col, { amp: 0.004, wave: 0.6 });
  const sideOutline = gableFront ? rect(0, 0, D, H) : [[0, 0], [D, 0], [D, H], [D / 2, H + (D / 2) * (ridge - H) / (D / 2)], [0, H]];
  for (const sx of [1, -1]) {
    const o = V(sx * (hw - (sx > 0 ? 0 : T)), 0, sx > 0 ? 0 : -D), u = V(0, 0, sx > 0 ? -1 : 1);
    const P = Mb.clone().multiply(basis(o, u, V(0, 1, 0)));
    k.cut(sideOutline, sideHoles.map((h) => (sx > 0 ? h : h.map(([x, y]) => [D - x, y]))), P, col, { amp: 0.004, wave: 0.6 });
  }
}

// ------------------------------------------------------------------ the blue toy shop
export function shop(k, opts = {}) {
  const { W, D, H, pitch, plinth } = SHOP, hw = W / 2, Mb = M([SHOP.x, 0, SHOP.z]);
  const F = (x = 0, y = 0, z = 0, rot = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], rot));
  const disp = (sx) => [sx * 1.65 - 0.66, 0.9, sx * 1.65 + 0.66, 2.3];
  const up = (sx) => [sx * 1.35 - 0.42, 3.9, sx * 1.35 + 0.42, 4.95];
  const g = [-0.36, 5.75, 0.36, 6.85];
  const dO = [DOOR.x - DOOR.w / 2, DOOR.y0, DOOR.x + DOOR.w / 2, DOOR.y0 + DOOR.h];
  const ridge = SHOP.ridge;
  walls(k, Mb, { W, D, H, ridge, gableFront: true, col: C.blue,
    frontHoles: [rect(...disp(-1)), rect(...disp(1)), rect(...dO), rect(...up(-1)), rect(...up(1)), arch(...g, 14)],
    sideHoles: [rect(1.8, 3.9, 2.7, 4.95), rect(1.6, 1.0, 3.0, 2.3)] });
  // lit insides
  for (const sx of [-1, 1]) {
    lightBox(k, F(), ...disp(sx), 0.7, { glow: 0xffd08a, extra: 1 });
    lightBox(k, F(), ...up(sx), 0.3, { glow: 0xffb866 });
    windowFrame(k, F(), ...disp(sx), { rows: 2, cols: 3, bar: 0.045, border: 0.1 });
    windowFrame(k, F(), ...up(sx), { rows: 2, cols: 2, bar: 0.045, border: 0.09 });
    // shutters and a pediment over the upper windows
    const [x0, y0, x1, y1] = up(sx);
    shutter(k, F(), x0 - 0.16, y0 - 0.05, 0.4, y1 - y0 + 0.1, -1, 0.5 + 0.1 * sx, C.red);
    shutter(k, F(), x1 + 0.16, y0 - 0.05, 0.4, y1 - y0 + 0.1, 1, 0.5 - 0.1 * sx, C.red);
    const cx = (x0 + x1) / 2;
    k.cut([[cx - 0.62, 0], [cx + 0.62, 0], [cx, 0.32]], [[[cx - 0.36, 0.06], [cx + 0.36, 0.06], [cx, 0.24]]], F(0, y1 + 0.17, T + 0.004), C.cream);
    k.cut([[cx - 0.5, 0.05], [cx + 0.5, 0.05], [cx, 0.27]], null, F(0, y1 + 0.17, T + 0.004 - T * 0.5), C.red, { t: T * 0.5 });
    k.cut(rect(cx - 0.62, -0.06, cx + 0.62, 0.02), null, F(0, y1 + 0.17, T * 2.2), C.cream, { amp: 0.002 });
    windowBox(k, F(), cx, y0 - 0.17, 1.05);
    // display window toys: shadow-puppet silhouettes in front of the glow, at three depths
    toysInWindow(k, F(sx * 1.65, 0.9, 0), sx);
    // side window light
  }
  const side = (sx, x0, y0, x1, y1) => { // side-wall windows (x along the depth) on both side walls, mirrored
    const P = Mb.clone().multiply(basis(V(sx * hw, 0, sx > 0 ? 0 : -D), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    const [a, b] = sx > 0 ? [x0, x1] : [D - x1, D - x0];
    lightBox(k, P, a, y0, b, y1, 0.3, { glow: 0xffb866 }); windowFrame(k, P, a, y0, b, y1, { rows: 2, cols: 2, border: 0.09 });
  };
  for (const sx of [1, -1]) { side(sx, 1.8, 3.9, 2.7, 4.95); side(sx, 1.6, 1.0, 3.0, 2.3); }
  lightBox(k, F(), ...g, 0.3, { glow: 0xffa860, archTop: true });
  windowFrame(k, F(), ...g, { archTop: true, border: 0.09, sill: true });

  // pilasters with stepped capitals and bases
  for (const sx of [-1, 1]) {
    const x = sx * (hw - 0.15);
    k.cut(rect(x - 0.14, plinth, x + 0.14, H - 0.2), null, F(0, 0, T + 0.004), C.cream, { amp: 0.003 });
    k.cut(rect(x - 0.09, plinth + 0.2, x + 0.09, H - 0.45), null, F(0, 0, T * 2 + 0.006), C.creamD, { amp: 0.002 });
    k.cut(rect(x - 0.2, H - 0.32, x + 0.2, H - 0.2), null, F(0, 0, T * 2 + 0.006), C.cream, { amp: 0.002 });
    k.cut(rect(x - 0.24, H - 0.22, x + 0.24, H - 0.12), null, F(0, 0, T * 3 + 0.008), C.cream, { amp: 0.002 });
    k.cut(rect(x - 0.19, plinth, x + 0.19, plinth + 0.14), null, F(0, 0, T * 2 + 0.006), C.cream, { amp: 0.002 });
  }
  // belt course with dentils (at the awning line) and an eave band with lace under the gable
  const dent = [[-hw - 0.1, 0.18], [-hw - 0.1, 0]];
  for (let x = -hw - 0.05; x < hw; x += 0.16) dent.push([x, 0], [x, -0.07], [x + 0.08, -0.07], [x + 0.08, 0]);
  dent.push([hw + 0.1, 0], [hw + 0.1, 0.18]);
  k.cut(dent.reverse(), null, F(0, 3.08, T + 0.004), C.cream, { amp: 0.002 });
  const lace = laceStrip(W + 0.2, 0.26, { scallop: 0.26, depth: 0.6 });
  k.cut([[-hw - 0.1, 0.12], ...lace.outline.map(([x, y]) => [x - hw - 0.1, y]), [hw + 0.1, 0.12]].reverse(), lace.holes.map((h) => translate2(h, -hw - 0.1, 0)), F(0, H - 0.02, T + 0.004), C.cream, { amp: 0.002 });
  // the sign: a board on spacers, a gilt frame, cut letters
  k.cut(rect(-1.35, -0.25, 1.35, 0.25), null, F(0, 3.47, T + 0.07), C.blueD, { amp: 0.003 });
  for (const x of [-1.1, 1.1]) k.cardBox(0.12, 0.12, 0.07, F(x, 3.41, T + 0.035, [0, 0, 0]), C.blueD, { amp: 0 });
  k.cut(rect(-1.43, -0.31, 1.43, 0.31), [rect(-1.3, -0.2, 1.3, 0.2)], F(0, 3.47, T * 2 + 0.07), C.gold, { batch: 'foil', amp: 0.003 });
  letters(k, 'TOYS', F(0, 3.47, T * 2 + 0.074), 0.3, C.gold);
  k.cut([[-1.45, 0], [1.45, 0], [1.4, 0.07], [0.6, 0.12], [-0.3, 0.06], [-1.0, 0.1]], null, F(0, 3.77, T + 0.07, [Math.PI / 2, 0, 0]), C.white, { tear: 0.01, amp: 0.01 });
  // plinth: a dark band and individually cut stones in two courses
  k.cut(rect(-hw - 0.04, 0, hw + 0.04, plinth), [], F(0, 0, T + 0.002), C.stoneD, { amp: 0.002 });
  for (let row = 0; row < 2; row++) {
    let x = -hw - 0.02 + row * 0.18;
    while (x < hw) {
      const w = 0.32 + k.r() * 0.3, x1 = Math.min(hw + 0.02, x + w);
      if (!(x1 > dO[0] - 0.05 && x < dO[2] + 0.05)) k.cut(roundRect(x + 0.02, row * 0.21 + 0.03, x1 - 0.02, row * 0.21 + 0.21, 0.04), null, F(0, 0, T * 2 + 0.004), k.r() < 0.5 ? C.stone : 0xa8a2aa, { amp: 0.006, wave: 0.15 });
      x = x1;
    }
  }
  // door frame (posts, lintel, stepped cornice), steps, the door itself (hinged, built separately)
  const [d0, , d1, dt] = dO;
  k.cut([[d0 - 0.17, plinth], [d0, plinth], [d0, dt], [d1, dt], [d1, plinth], [d1 + 0.17, plinth], [d1 + 0.17, dt + 0.17], [d0 - 0.17, dt + 0.17]], null, F(0, 0, T + 0.004), C.cream, { amp: 0.003 });
  k.cut(rect(d0 - 0.26, dt + 0.17, d1 + 0.26, dt + 0.27), null, F(0, 0, T * 2 + 0.006), C.cream, { amp: 0.002 });
  k.cut(rect(d0 - 0.32, dt + 0.27, d1 + 0.32, dt + 0.34), null, F(0, 0, T * 3 + 0.008), C.cream, { amp: 0.002 });
  k.cut(rect(d0 + 0.08, 0, d1 - 0.08, 0.14), null, F(0, dt + 0.2, T * 4 + 0.01), C.green, { amp: 0.002 });
  k.cardBox(1.6, 0.22, 0.55, F(0, 0, 0.29), C.stone, { amp: 0.002 });
  k.cardBox(1.3, 0.42, 0.3, F(0, 0, 0.16), C.stone, { amp: 0.002 });
  // awning, roof, chimney, the room behind the door
  awning(k, Mb, -2.45, 2.45, 3.02, 1.1);
  const roof = tiledRoof(k, Mb, { halfSpan: hw, eaveH: H, pitch, zf: 0.3, zb: -D - 0.3, ov: 0.35 });
  bargeboards(k, Mb, { halfSpan: hw, eaveH: H, pitch, ov: 0.35, z: 0.3 + T });
  chimney(k, Mb, 1.35, -2.4, roof.heightAt(1.35), 9.2);
  interior(k, Mb);
  return { ridge };
}

function letters(k, word, F, h, col) {
  // block letters cut from gilt card: T, O, Y, S built from strokes; S is two arcs
  const s = h * 0.17, gap = h * 0.25; let x = -((word.length * (h * 0.72 + gap)) - gap) / 2;
  const o = { batch: 'foil', amp: 0.0015, t: T };
  for (const ch of word) {
    const w = h * 0.72, cx = x + w / 2;
    if (ch === 'T') { k.cut(rect(x, h / 2 - s, x + w, h / 2), null, F, col, o); k.cut(rect(cx - s / 2, -h / 2, cx + s / 2, h / 2 - s), null, F, col, o); }
    if (ch === 'O') k.cut(ellipse(cx, 0, w / 2, h / 2, 28), [ellipse(cx, 0, w / 2 - s, h / 2 - s, 28)], F, col, o);
    if (ch === 'Y') {
      k.cut([[x, h / 2], [x + s * 1.1, h / 2], [cx, 0.02], [cx, -0.08 * h]], null, F, col, o);
      k.cut([[x + w - s * 1.1, h / 2], [x + w, h / 2], [cx + s / 2, 0.0], [cx - s / 2, -0.02]], null, F, col, o);
      k.cut(rect(cx - s / 2, -h / 2, cx + s / 2, 0.02), null, F, col, o);
    }
    if (ch === 'S') {
      const arcP = (cy, r, a0, a1, rr) => { const p = []; for (let i = 0; i <= 16; i++) { const a = a0 + (a1 - a0) * (i / 16); p.push([cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr]); } return p; };
      const r1 = h / 4;
      const top = [...arcP(h / 4, r1, -0.25 * Math.PI, -1.5 * Math.PI, r1), ...arcP(h / 4, r1 - s, -1.5 * Math.PI, -0.25 * Math.PI, r1 - s).reverse().reverse()];
      const outerT = arcP(h / 4, r1, 0.15 * Math.PI, 1.5 * Math.PI, r1), innerT = arcP(h / 4, r1 - s, 1.5 * Math.PI, 0.15 * Math.PI, r1 - s);
      const outerB = arcP(-h / 4, r1, 0.5 * Math.PI, -0.85 * Math.PI + 2 * Math.PI - 2 * Math.PI, r1);
      k.cut([...outerT, ...innerT], null, F, col, o);
      const ob = arcP(-h / 4 + 0.0, r1, 0.5 * Math.PI, -0.85 * Math.PI, r1), ib = arcP(-h / 4, r1 - s, -0.85 * Math.PI, 0.5 * Math.PI, r1 - s);
      k.cut([...ob, ...ib], null, F, col, o);
      void top; void outerB;
    }
    x += w + gap;
  }
}

function awning(k, Mb, x0, x1, yTop, depth) {
  const yFront = yTop - 0.42, drop = 0.36, n = Math.round((x1 - x0) / 0.35), sw = (x1 - x0) / n;
  const slope = V(0, yFront - yTop, depth), sl = slope.length();
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * sw, col = i % 2 ? C.cream : C.green, lift = (i % 2) * 0.008;
    const P = Mb.clone().multiply(basis(V(xa, yTop, T), V(1, 0, 0), slope)).multiply(M([0, 0, lift]));
    k.cut(rect(-0.01, 0, sw + 0.01, sl), null, P, col, { amp: 0.003, wave: 0.4 });
    // valance tab with a round scallop, folded down at the front edge
    const tab = [[-0.01, 0], [sw + 0.01, 0], [sw + 0.01, -drop * 0.55]];
    for (let q = 0; q <= 16; q++) { const a = (q / 16) * Math.PI; tab.push([sw / 2 + Math.cos(a) * (sw / 2 + 0.01), -drop * 0.55 - Math.sin(a) * drop * 0.45]); }
    tab.push([-0.01, -drop * 0.55]);
    k.cut(tab, null, Mb.clone().multiply(M([xa, yFront, T + depth + lift + 0.01])), col, { amp: 0.003 });
  }
  for (const x of [x0, x1]) {   // cheeks
    const P = Mb.clone().multiply(basis(V(x, 0, T), V(0, 0, 1), V(0, 1, 0)));
    k.cut([[0, yTop], [depth + 0.02, yFront], [depth + 0.02, yFront - drop * 0.55], [0.2, yTop - 0.45]], null, P, C.green, { amp: 0.003 });
  }
  // snow scraps on the awning slope
  for (let i = 0; i < 5; i++) {
    const xa = x0 + 0.3 + k.r() * (x1 - x0 - 0.6), P = Mb.clone().multiply(basis(V(xa, yTop, T + 0.03), V(1, 0, 0), slope));
    k.cut(ellipse(0, 0.25 + k.r() * 0.6, 0.3 + k.r() * 0.3, 0.12 + k.r() * 0.08, 16), null, P.multiply(M([0, 0, 0.012 + i * 0.002])), C.white, { tear: 0.012, tearWave: 0.04, amp: 0.012 });
  }
  // the awning frame rail
  k.cut(rect(x0, -0.03, x1, 0.03), null, Mb.clone().multiply(M([0, yFront, T + depth - 0.02])), C.ink, { amp: 0 });
}

function chimney(k, Mb, x, z, yRoof, yTop) {
  const w = 0.72, d = 0.8, y0 = yRoof - 0.6, h = yTop - y0;
  k.cardBox(w, h, d, Mb.clone().multiply(M([x, y0, z])), C.brick, { amp: 0.002 });
  // bricks on the two faces you can see (front +z and outer +x), course by course
  for (const face of [0, 1]) {
    const P = face === 0 ? Mb.clone().multiply(M([x, y0, z + d / 2])) : Mb.clone().multiply(basis(V(x + w / 2, y0, z + d / 2), V(0, 0, -1), V(0, 1, 0))).multiply(M([d / 2, 0, 0]));
    const fw = face === 0 ? w : d;
    for (let row = 0, y = 0.5; y < h - 0.18; row++, y += 0.12) {
      for (let bx = -fw / 2 + (row % 2) * 0.1 - 0.1; bx < fw / 2; bx += 0.21) {
        const a = Math.max(-fw / 2, bx), b = Math.min(fw / 2, bx + 0.19); if (b - a < 0.05) continue;
        k.cut(rect(a + 0.005, y, b - 0.005, y + 0.1), null, P, k.r() < 0.4 ? C.brickD : (k.r() < 0.5 ? 0xb4553f : C.brick), { t: T * 0.6, amp: 0.003, wave: 0.1, vary: 0.08 });
      }
    }
  }
  k.cardBox(w + 0.2, 0.14, d + 0.2, Mb.clone().multiply(M([x, yTop, z])), C.stoneD, { amp: 0.002 });
  k.cut(ellipse(0, 0, 0.55, 0.48, 18), null, Mb.clone().multiply(M([x, yTop + 0.15, z], [-Math.PI / 2, 0, 0.2])), C.white, { tear: 0.012, tearWave: 0.04, amp: 0.02 });
}

/** silhouettes of toys in the display window: a teddy, a rocking horse, a drum and a little train */
function toysInWindow(k, F, sx) {
  const dark = 0x4a2a22;
  const at = (x, y, z) => F.clone().multiply(M([x, y, -z]));
  if (sx < 0) {
    // teddy bear: body, head, ears as circles cut in one piece
    const bear = [...ellipse(0, 0.2, 0.17, 0.2, 18)];
    k.cut(bear, null, at(-0.3, 0.02, 0.32), 0x8a5a3a, { amp: 0.004 });
    k.cut(circle(0, 0.5, 0.13, 16), null, at(-0.3, 0.02, 0.31), 0x8a5a3a);
    for (const e of [-1, 1]) k.cut(circle(e * 0.1, 0.62, 0.05, 10), null, at(-0.3, 0.02, 0.305), 0x6a4028);
    k.cut(ellipse(0, 0.18, 0.09, 0.11, 12), null, at(-0.3, 0.02, 0.29), 0xd9b48a);
    k.cut(circle(0, 0.46, 0.045, 10), null, at(-0.3, 0.02, 0.28), 0xd9b48a);
    // rocking horse
    const horse = [[-0.25, 0.05], [0.25, 0.05], [0.18, 0.12], [0.16, 0.32], [0.3, 0.55], [0.22, 0.6], [0.08, 0.44], [-0.14, 0.42], [-0.22, 0.48], [-0.24, 0.3], [-0.16, 0.12]];
    k.cut(horse, null, at(0.25, 0.02, 0.45), C.red, { amp: 0.004 });
    k.cut([[-0.32, 0.0], [0.32, 0.0], [0.26, 0.06], [-0.26, 0.06]], null, at(0.25, 0.0, 0.44), dark);
    k.cut(rect(-0.4, -0.02, 0.4, 0.04), null, at(0, -0.01, 0.6), C.wood, { amp: 0.002 });
  } else {
    // a drum (folded band) and a train
    const P = at(-0.32, 0.02, 0.4);
    k.cut(rect(-0.16, 0, 0.16, 0.24), null, P, C.red); k.cut(rect(-0.17, 0.0, 0.17, 0.04), null, P.clone().multiply(M([0, 0, T])), C.gold, { batch: 'foil' }); k.cut(rect(-0.17, 0.2, 0.17, 0.24), null, P.clone().multiply(M([0, 0, T])), C.gold, { batch: 'foil' });
    for (let i = 0; i < 4; i++) k.cut([[-0.16 + i * 0.08, 0.04], [-0.12 + i * 0.08, 0.2], [-0.08 + i * 0.08, 0.04]], null, P.clone().multiply(M([0, 0, T])), C.cream, { t: T * 0.5, amp: 0 });
    const Q = at(0.22, 0.02, 0.3);
    k.cut([[-0.32, 0.06], [0.2, 0.06], [0.2, 0.22], [0.08, 0.22], [0.08, 0.36], [-0.04, 0.36], [-0.04, 0.22], [-0.32, 0.22]], null, Q, C.green);
    k.cut(rect(0.2, 0.06, 0.38, 0.26), null, Q, C.blueD);
    for (const wx of [-0.22, -0.02, 0.24]) k.cut(circle(wx, 0.07, 0.065, 12), null, Q.clone().multiply(M([0, 0, T])), C.ink);
    k.cut(rect(-0.03, 0.33, 0.07, 0.42), null, Q.clone().multiply(M([0, 0, -0.01])), C.ink);
  }
}

/** the room behind the shop door: plank floor, shelves of paper toys, a warm lamp */
function interior(k, Mb) {
  const w = 1.9, d = 3.0, y0 = SHOP.plinth, h = 2.5, P = (x, y, z, r = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], r));
  for (let i = 0; i < 8; i++) k.cut(rect(-w / 2 + i * w / 8, 0, -w / 2 + (i + 1) * w / 8 - 0.008, d), null, P(0, y0, 0, [-Math.PI / 2, 0, 0]), i % 2 ? 0x8a5a36 : 0x7a4b2a, { amp: 0.003, wave: 0.6 });
  k.cut(rect(-w / 2, 0, w / 2, h), null, P(0, y0, -d), 0xe9d3a6, { amp: 0.002 });
  for (const s of [-1, 1]) k.cut(rect(-d, 0, 0, h), null, P(s * w / 2, y0, 0, [0, -Math.PI / 2, 0]), 0xd8b98a, { amp: 0.002 });
  k.cut(rect(-w / 2, -d, w / 2, 0), null, P(0, y0 + h, 0, [Math.PI / 2, 0, 0]), 0xcfae7e, { amp: 0.002 });
  const cols = [C.red, C.blue, C.green, C.gold, 0x9a4f8f, C.cream];
  for (const sy of [0.9, 1.5, 2.1]) {
    k.cut(rect(-w / 2 + 0.05, -0.3, w / 2 - 0.05, 0), null, P(0, y0 + sy, -d + 0.3, [-Math.PI / 2, 0, 0]), C.wood, { amp: 0.002 });
    k.cut(rect(-w / 2 + 0.05, -0.05, w / 2 - 0.05, 0), null, P(0, y0 + sy, -d + 0.3), 0x5f3a20, { amp: 0.002 });
    let x = -w / 2 + 0.12;
    while (x < w / 2 - 0.2) { const bw = 0.12 + k.r() * 0.14, bh = 0.12 + k.r() * 0.22; k.cardBox(bw, bh, 0.16, P(x + bw / 2, y0 + sy, -d + 0.15), k.r() < 0.9 ? cols[(k.r() * cols.length) | 0] : C.cream, { amp: 0.002 }); x += bw + 0.04; }
  }
  // a counter
  k.cardBox(1.0, 0.85, 0.4, P(0.35, y0, -1.6), C.wood, { amp: 0.002 });
}

// ------------------------------------------------------------------ the pink house (eaves to the street, gables at the sides)
export function pinkHouse(k) {
  const { W, D, H, pitch, plinth } = PINK, hw = W / 2, Mb = M([PINK.x, 0, PINK.z]);
  const F = (x = 0, y = 0, z = 0, rot = [0, 0, 0]) => Mb.clone().multiply(M([x, y, z], rot));
  const ups = [[-0.95 - 0.4, 2.65, -0.95 + 0.4, 3.55], [0.95 - 0.4, 2.65, 0.95 + 0.4, 3.55]];
  const dO = [1.25 - 0.44, plinth, 1.25 + 0.44, plinth + 1.95];
  const bay = [-1.45, 0.85, -0.15, 2.05];
  walls(k, Mb, { W, D, H, ridge: PINK.ridge, gableFront: false, col: C.pink,
    frontHoles: [...ups.map((u) => rect(...u)), arch(...dO, 12), rect(...bay)], sideHoles: [arch(D / 2 - 0.35, 3.95, D / 2 + 0.35, 4.85, 12)] });
  for (const u of ups) {
    lightBox(k, F(), ...u, 0.3, { glow: 0xffb36a });
    windowFrame(k, F(), ...u, { rows: 2, cols: 2, border: 0.09 });
    shutter(k, F(), u[0] - 0.15, u[1] - 0.04, 0.36, u[3] - u[1] + 0.08, -1, 0.35, C.sage);
    shutter(k, F(), u[2] + 0.15, u[1] - 0.04, 0.36, u[3] - u[1] + 0.08, 1, 0.42, C.sage);
    windowBox(k, F(), (u[0] + u[2]) / 2, u[1] - 0.16, 0.95);
  }
  // gable-end round-top windows
  for (const sx of [1, -1]) {
    const P = Mb.clone().multiply(basis(V(sx * (hw - (sx > 0 ? 0 : T)), 0, sx > 0 ? 0 : -D), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0)));
    lightBox(k, P, D / 2 - 0.35, 3.95, D / 2 + 0.35, 4.85, 0.25, { glow: 0xffa860, archTop: true });
    windowFrame(k, P, D / 2 - 0.35, 3.95, D / 2 + 0.35, 4.85, { archTop: true, border: 0.08 });
    bargeboards(k, Mb.clone().multiply(basis(V(sx * (hw + 0.32 + T), 0, -D / 2), V(0, 0, sx > 0 ? -1 : 1), V(0, 1, 0))), { halfSpan: D / 2, eaveH: H, pitch, ov: 0.35, z: 0 });
  }
  // door: arched, with a fanlight and a frame; the door leaf (plum) with layered panels
  lightBox(k, F(), dO[0], dO[3] - 0.5, dO[2], dO[3], 0.12, { glow: 0xffc070, archTop: true });
  k.cut(arch(dO[0] - 0.14, dO[1], dO[2] + 0.14, dO[3] + 0.14, 14), [arch(...dO, 14)], F(0, 0, T + 0.004), C.cream, { amp: 0.003 });
  k.cut(rect(dO[0] + 0.01, dO[1], dO[2] - 0.01, dO[3] - 0.52), null, F(0, 0, -0.06), C.plum, { amp: 0.002 });
  for (const yy of [0.25, 0.85]) for (const xx of [-0.2, 0.2]) k.cut(roundRect(1.25 + xx - 0.14, plinth + yy, 1.25 + xx + 0.14, plinth + yy + 0.5, 0.03), null, F(0, 0, -0.06 + T), 0x6e1a20, { amp: 0.002 });
  k.cut(circle(1.25 - 0.3, plinth + 0.95, 0.04, 10), null, F(0, 0, -0.06 + T * 2), C.gold, { batch: 'foil', amp: 0 });
  wreath(k, F(1.25, plinth + 1.35, T * 2));
  k.cardBox(1.25, 0.2, 0.5, F(1.25, 0, 0.25), C.stone, { amp: 0.002 });
  // bay window: three faces, each with an opening and glow, a little hipped roof of tabs
  const bx = (bay[0] + bay[2]) / 2, bw = bay[2] - bay[0], depth = 0.5, ang = Math.PI / 4, sideW = depth / Math.sin(ang);
  const bayFaces = [
    { o: V(bx - bw / 2 + depth / Math.tan(ang), 0, depth), u: V(1, 0, 0), w: bw - 2 * depth / Math.tan(ang) },
    { o: V(bx - bw / 2, 0, 0), u: V(Math.cos(ang), 0, Math.sin(ang)), w: sideW },
    { o: V(bx + bw / 2 - depth / Math.tan(ang), 0, depth), u: V(Math.cos(ang), 0, -Math.sin(ang)), w: sideW },
  ];
  for (const f of bayFaces) {
    const P = Mb.clone().multiply(basis(f.o, f.u, V(0, 1, 0)));
    const hole = rect(0.1, 1.0, f.w - 0.1, 2.0);
    k.cut(rect(0, 0, f.w, 2.25), [hole], P, C.pink, { amp: 0.003 });
    k.cut(rect(0.12, 1.02, f.w - 0.12, 1.98), null, P.clone().multiply(M([0, 0, -0.08])), 0xffc27a, { batch: 'vellum', amp: 0.003 });
    k.cut(rect(0.04, 0.94, f.w - 0.04, 2.06), [rect(0.1, 1.0, f.w - 0.1, 2.0)], P.clone().multiply(M([0, 0, T + 0.003])), C.cream, { amp: 0.002 });
    k.cut(rect(f.w / 2 - 0.02, 1.0, f.w / 2 + 0.02, 2.0), null, P.clone().multiply(M([0, 0, T + 0.003])), C.cream, { amp: 0 });
    k.cut(rect(-0.02, 0, f.w + 0.02, 0.35), null, P.clone().multiply(M([0, 0, T + 0.003])), C.stone, { amp: 0.004 });
    for (let i = 0; i < 6; i++) { const ty = 2.25 + i * 0.05; k.cut(rect(-0.03 - i * 0.01, 0, f.w + 0.03 + i * 0.01, 0.12), null, P.clone().multiply(M([0, ty, 0.03 + i * 0.03], [-0.9, 0, 0])), i % 2 ? C.roofRL : C.roofR, { amp: 0.003 }); }
  }
  k.cut([[bay[0] - 0.05, 0], [bay[2] + 0.05, 0], [bay[2] + 0.05 - depth, depth + 0.08], [bay[0] - 0.05 + depth, depth + 0.08]], null, F(0, 2.62, 0, [Math.PI / 2, 0, 0]), C.white, { tear: 0.01, amp: 0.01 });
  // eave lace across the front, corner boards, plinth stones
  const lace = laceStrip(W + 0.5, 0.3, { scallop: 0.24, depth: 0.55 });
  k.cut([[-hw - 0.25, 0.1], ...lace.outline.map(([x, y]) => [x - hw - 0.25, y]), [hw + 0.25, 0.1]].reverse(), lace.holes.map((h) => translate2(h, -hw - 0.25, 0)), F(0, H - 0.04, 0.36), C.cream, { amp: 0.002 });
  for (const sx of [-1, 1]) k.cut(rect(sx * hw - 0.13, plinth, sx * hw + 0.02 * sx, H), null, F(sx > 0 ? -0.0 : 0.11, 0, T + 0.004), C.cream, { amp: 0.002 });
  k.cut(rect(-hw - 0.03, 0, hw + 0.03, plinth), [], F(0, 0, T + 0.002), C.stoneD, { amp: 0.002 });
  for (let x = -hw; x < hw;) { const w = 0.28 + k.r() * 0.25, x1 = Math.min(hw, x + w); if (!(x1 > dO[0] - 0.1 && x < dO[2] + 0.1)) k.cut(roundRect(x + 0.02, 0.04, x1 - 0.02, plinth - 0.03, 0.04), null, F(0, 0, T * 2 + 0.004), 0xa79a8c, { amp: 0.006, wave: 0.15 }); x = x1; }
  // roof (ridge along x: rotate the canonical frame)
  const R = Mb.clone().multiply(M([0, 0, -D / 2], [0, Math.PI / 2, 0]));
  const roof = tiledRoof(k, R, { halfSpan: D / 2, eaveH: H, pitch, zf: hw + 0.32, zb: -hw - 0.32, ov: 0.38, col: C.roofR, col2: C.roofRL, shape: 'tab', tile: 0.24, rowH: 0.21, snowTop: 0.6 });
  // chimney on the back slope
  chimney(k, R, -0.9, -1.0, roof.heightAt(-0.9), PINK.ridge + 0.9);
}

export function wreath(k, F) {
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, P = F.clone().multiply(M([Math.cos(a) * 0.17, Math.sin(a) * 0.17, (i % 2) * 0.012], [0, 0, a + Math.PI / 2]));
    k.cut(ellipse(0, 0, 0.1, 0.045, 10), null, P, i % 3 ? C.holly : C.green, { t: T * 0.7, amp: 0.002, vary: 0.08 });
  }
  for (const s of [-1, 1]) k.cut([[0, 0], [s * 0.12, 0.06], [s * 0.13, -0.05]], null, F.clone().multiply(M([0, -0.17, 0.04])), C.berry, { t: T * 0.7, amp: 0.002 });
  k.cut([[-0.02, 0], [0.02, 0], [0.05, -0.16], [0.0, -0.13], [-0.05, -0.16]], null, F.clone().multiply(M([0, -0.17, 0.05])), C.berry, { t: T * 0.7, amp: 0.002 });
}
