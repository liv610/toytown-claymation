// The textile construction language: how this handmade world is physically put together.
//
// The rule: the handmade look comes from believable construction, not from noise or decoration.
// Every function here builds something the way a maker would build it with real material:
//
//   panel()        a cut piece of felt or cloth with real thickness, a rolled edge, a little stuffing behind it and
//                  soft puckers where it is sewn down. It is the base unit of everything: walls, doors, shutters, signs, patches.
//   sewnWall()     a wall made of several panels lapped over each other and sewn along the laps, slightly out of square
//   shingleRoof()  a roof of individually cut fabric tabs in overlapping rows (two or three coordinating fabrics),
//                  the ridge line sagging a little, a folded ridge strip blanket-stitched down, batting snow on top
//   woodFrame() / boundFrame()   window frames of painted wood strips (mitred, a touch misaligned) or bound cloth
//   feltFir()      a tree of overlapping felt branches in tiers (reads as a tree from every height, not as stacked plates)
//   cutStones()    a street of individually cut stones laid in hand-designed courses
//
// Stitching is only placed where it holds something together (laps, bindings, appliqué edges, ridge strips).
// All units are metres at village scale (Toy Town's own coordinates; three.js: x east, y up, z toward the street).
import * as THREE from 'three';
import Delaunator from 'delaunator';
import { M, V, rng, rect, roundRect, resample, ccw, signedArea, handCut, TAU, basis } from './vendor/kit.js';
import { fbm3js } from './vendor/felt_kit.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ 2D helpers
function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function bounds(p) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; }
/** clip a polygon to the vertical band xa ≤ x ≤ xb (Sutherland–Hodgman, two half-planes) */
export function clipBand(p, xa, xb) {
  const clipHalf = (poly, inside, cross) => { const o = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b); if (ia) o.push(a); if (ia !== ib) o.push(cross(a, b)); } return o; };
  const at = (x) => (a, b) => { const t = (x - a[0]) / (b[0] - a[0]); return [x, a[1] + (b[1] - a[1]) * t]; };
  return clipHalf(clipHalf(p, (q) => q[0] >= xa, at(xa)), (q) => q[0] <= xb, at(xb));
}
/** offset a closed polygon by d along its vertex normals (d > 0 = outward); fine for small d */
function offsetPoly(p, d) {
  const n = p.length, s = signedArea(p) >= 0 ? 1 : -1;
  return p.map(([x, y], i) => {
    const [xa, ya] = p[(i - 1 + n) % n], [xb, yb] = p[(i + 1) % n];
    let tx = xb - xa, ty = yb - ya; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return [x + ty * s * d, y - tx * s * d];
  });
}

// ------------------------------------------------------------------ the panel
export const panelFallbacks = { count: 0 };
/**
 * A cut piece of felt or cloth, front face at z = t, back at 0.
 *   stuff     how far the middle is pushed out by padding behind it (metres); 0 for flat felt
 *   pucker    depth of the soft ripples next to the sewn edges; ripple length `wave`
 *   grid      spacing of interior points (the face must be fine enough to carry stuffing and puckers)
 *   roll      how rounded the cut edge is (0 = crisp like card)
 * Edges stay exactly on the outline, so neighbouring pieces never crack apart.
 */
export function panelGeo(outline, holes = [], { t = 0.06, stuff = 0, pucker = 0, wave = 0.11, grid = 0.14, roll = 0.35, seed = 1, seamLines = [] } = {}) {
  // the rim needs points as close together as the face does, or long slivers tip steeply once the face is stuffed
  const dense = stuff || pucker ? (p) => resample(p, grid * 0.5) : (p) => p;   // (only the seam band needs finer points)
  const O = dense(ccw(outline)), H = (holes || []).map((h) => dense(ccw(h)).slice().reverse());
  const [bx0, by0, bx1, by1] = bounds(O), r = rng(seed);
  // boundary samples for the distance field (stuffing and puckers are shaped by the distance to the nearest sewn edge)
  const segs = []; for (const poly of [O, ...H]) { const q = resample(poly, 0.05); let s = 0; for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; segs.push([a[0], a[1], b[0], b[1], s]); s += Math.hypot(b[0] - a[0], b[1] - a[1]); } }
  const near = (x, y) => { let best = 1e9, along = 0; for (const [ax, ay, bx, by, s0] of segs) { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9; const u = clamp(((x - ax) * dx + (y - ay) * dy) / L2); const px = ax + dx * u, py = ay + dy * u, d = Math.hypot(x - px, y - py); if (d < best) { best = d; along = s0 + u * Math.sqrt(L2); } } return [best, along]; };
  // interior (Steiner) points on a jittered grid, kept away from the edges
  const steiner = [];
  if (stuff || pucker) for (let y = by0 + grid / 2; y < by1; y += grid) for (let x = bx0 + grid / 2; x < bx1; x += grid) {
    const px = x + (r() - 0.5) * grid * 0.5, py = y + (r() - 0.5) * grid * 0.5;
    if (!inPoly(px, py, O) || H.some((h) => inPoly(px, py, h))) continue;
    if (near(px, py)[0] < grid * 0.45) continue;
    steiner.push([px, py]);
  }
  // seams: the cloth gathers into small puckers along the stitching, so the face needs fine points there
  const seamSegs = seamLines.map(([ax, ay, bx, by]) => [ax, ay, bx, by, Math.hypot(bx - ax, by - ay)]);
  const seamNear = (x, y) => { let best = 1e9, along = 0; for (const [ax, ay, bx, by, L] of seamSegs) { const u = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L || 1e-9)); const d = Math.hypot(x - ax - (bx - ax) * u, y - ay - (by - ay) * u); if (d < best) { best = d; along = u * L; } } return [best, along]; };
  if (pucker && seamSegs.length) {
    // grid points crowding the seam band give way to a fine band of points that follows the seam
    for (let i = steiner.length - 1; i >= 0; i--) if (seamNear(...steiner[i])[0] < 0.16) steiner.splice(i, 1);
    const step = wave / 3;
    for (const [ax, ay, bx, by, L] of seamSegs) {
      const tx = (bx - ax) / L, ty = (by - ay) / L, nx = -ty, ny = tx;
      for (let u = step; u < L - step / 2; u += step) for (const off of [0.022, 0.06, 0.12, -0.022, -0.06, -0.12]) {
        const px = ax + tx * u + nx * off, py = ay + ty * u + ny * off;
        if (!inPoly(px, py, O) || H.some((h) => inPoly(px, py, h)) || near(px, py)[0] < 0.012) continue;
        steiner.push([px, py]);
      }
    }
  }
  const rim = [O, ...H];
  const flat = [...O, ...H.flat(), ...steiner];
  // front face: Delaunay over the dense rim + interior points, keeping the triangles that lie in the cloth.
  // (The rim is sampled more finely than any interior point's distance to it, so every rim edge survives.)
  const D = Delaunator.from(flat), faces = [];
  for (let i = 0; i < D.triangles.length; i += 3) {
    const a = D.triangles[i], b = D.triangles[i + 1], c = D.triangles[i + 2];
    const cx = (flat[a][0] + flat[b][0] + flat[c][0]) / 3, cy = (flat[a][1] + flat[b][1] + flat[c][1]) / 3;
    if (inPoly(cx, cy, O) && !H.some((h) => inPoly(cx, cy, h))) faces.push([a, c, b]);
  }
  const backFaces = THREE.ShapeUtils.triangulateShape(O.map(([x, y]) => new THREE.Vector2(x, y)), H.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y))));
  // every rim edge must survive (where cloth turns tightly round an opening Delaunay can skip one and the face loses a
  // sliver); if any is missing, this panel falls back to the exact outline triangulation, flat but watertight
  { const have = new Set(); for (const [p, q, r] of faces) for (const [u, v] of [[p, q], [q, r], [r, p]]) have.add(u < v ? u + ',' + v : v + ',' + u);
    let off = 0, missing = 0; for (const poly of [O, ...H]) { const n = poly.length; for (let i = 0; i < n; i++) { const u = off + i, v = off + (i + 1) % n; if (!have.has(u < v ? u + ',' + v : v + ',' + u)) missing++; } off += n; }
    if (missing) { panelFallbacks.count++; faces.length = 0; for (const f of backFaces) faces.push([f[0], f[1], f[2]]); steiner.length = 0; } }
  const pos = [], idx = [];
  const bulge = (x, y) => {
    if (!stuff && !pucker) return 0;
    const [d, s] = near(x, y);
    let z = stuff * sstep(0, 0.45, d) * (0.75 + 0.5 * fbm3js(x * 1.7, y * 1.7, seed, seed));
    if (pucker && seamSegs.length) { const [ds, as] = seamNear(x, y); z += pucker * Math.sin((as / wave) * TAU + 0.6 * Math.sin(as * 3.1 + seed)) * Math.exp(-ds / 0.05) * sstep(0.0, 0.025, d); z -= pucker * 0.8 * Math.exp(-ds / 0.03); }
    return z;
  };
  // front face (displaced), back face (flat, inset)
  const f0 = 0; for (const [x, y] of flat) pos.push(x, y, t + bulge(x, y));
  for (const [a, b, c] of faces) idx.push(f0 + a, f0 + b, f0 + c);
  const b0 = pos.length / 3, backPts = [...O, ...H.flat()];
  for (const [x, y] of backPts) pos.push(x, y, 0);
  for (const [a, b, c] of backFaces) idx.push(b0 + a, b0 + c, b0 + b);
  // the cut edge: front rim → a slightly proud middle ring → back rim (a rolled felt edge; roll = 0 is a crisp card edge)
  let off = 0;
  for (const poly of rim) {
    const n = poly.length, mid = offsetPoly(poly, t * 0.22 * roll), m0 = pos.length / 3;
    for (const [x, y] of mid) pos.push(x, y, t * 0.5);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, F = f0 + off + i, Fj = f0 + off + j, Bk = b0 + off + i, Bj = b0 + off + j, Mi = m0 + i, Mj = m0 + j;
      idx.push(F, Mi, Fj, Fj, Mi, Mj, Mi, Bk, Mj, Mj, Bk, Bj);
    }
    off += n;
  }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// ------------------------------------------------------------------ the kit extension
/**
 * Adds construction-level helpers to a textile kit (vendor makeKit()).
 * Everything goes through k.B[batch].add so batching, UVs that follow the cut, and per-piece variation all apply.
 */
export function extendKit(k) {
  const sd = () => (k.r() * 1e6) | 0;
  /** one sewn panel (see panelGeo); the outline can be hand-cut first (amp) */
  k.panel = (outline, holes, matrix, color, { batch = 'felt', amp = 0.01, wave = 0.5, vary = 0.05, extra = 0, ...o } = {}) => {
    const ol = amp ? handCut(outline, { amp, wave, seed: sd() }) : outline;
    const hs = (holes || []).map((h) => (amp ? handCut(h, { amp: amp * 0.5, wave: 0.25, seed: sd() }) : h));
    k.B[batch].add(panelGeo(ol, hs, { seed: sd() % 997, ...o }), matrix, color, { vary, extra });
    return ol;
  };

  /**
   * A wall sewn from several vertical panels. seams: x positions of the laps (chosen between openings).
   * Each panel is cut a little differently (a hair out of square, its own stuffing), laps over its neighbour by `lap`
   * and is sewn down along that lap with a running stitch — the only stitching on the wall.
   */
  k.sewnWall = (outline, holes, F, color, { seams = [], lap = 0.05, t = 0.07, stuff = 0.035, pucker = 0.006, batch = 'felt', thread = 0xf4ead6, colors = null, skew = 0.004, stitch = true, grid = 0.14 } = {}) => {
    const [x0, , x1] = bounds(outline);
    // a maker never runs a seam through a window: move each seam to the nearest wall between openings
    const hb = (holes || []).map(bounds), clear = (x) => hb.every(([a, , b]) => x < a - 0.1 || x > b + 0.1);
    seams = seams.map((x) => { for (let d = 0; d < 1.5; d += 0.02) { if (clear(x + d)) return x + d; if (clear(x - d)) return x - d; } return null; }).filter((x) => x !== null);
    const xs = [x0 - 0.01, ...seams, x1 + 0.01];
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i] - (i ? lap : 0), b = xs[i + 1];
      const piece = clipBand(outline, a, b); if (piece.length < 3) continue;
      const myHoles = (holes || []).filter((h) => { const [hx0, , hx1] = bounds(h); const c = (hx0 + hx1) / 2; return c > a && c < b; });
      // a hair out of square: each panel leans and shifts by a few millimetres, and sits a little proud of the one it laps
      const P = F.clone().multiply(M([0, 0, i * 0.008], [0, 0, (k.r() - 0.5) * skew]));
      const [, py0, , py1] = bounds(piece);
      const seamLines = [i ? [a + 0.022, py0, a + 0.022, py1] : null, i < xs.length - 2 ? [b - 0.02, py0, b - 0.02, py1] : null].filter(Boolean);
      k.panel(piece, myHoles, P, colors ? colors[i % colors.length] : color, { batch, t, stuff, pucker, amp: 0.008, wave: 0.6, seamLines, grid });
      if (i && stitch) {   // sewn along the lap
        const lx = a + 0.022;
        const top = Math.max(...piece.filter(([x]) => Math.abs(x - a) < 0.02).map(([, y]) => y), py0 + 0.1);
        k.S.running(P, [[lx, py0 + 0.06], [lx, Math.min(py1, top) - 0.06]], t + 0.004, thread, { len: 0.06, gap: 0.042, r: 0.0075, jitter: 0.004 });
      }
    }
  };

  /**
   * A roof of overlapping fabric tabs. Cut piece by piece: widths vary, each tab sits at its own small angle,
   * some lift at the corner, rows sag toward the middle of the span. fabrics: [{ color, batch, extra }] chosen
   * mostly from the first, with the others as occasional patches (like a maker using up two or three remnants).
   * F: frame of the gable end at the eave line (x across, y up, z along the ridge from zb to zf).
   */
  k.shingleRoof = (F, { halfSpan, eaveH, pitch, zf, zb, ov = 0.35, rowH = 0.27, tile = 0.32, fabrics, shape = 'round', sag = 0.07, snowTop = 0.5, under = 0x2c2a3a, thread = 0x3a2c26, ridgeCol = null, snow = true }) => {
    const c = Math.cos(pitch), s = Math.sin(pitch), run = halfSpan + ov, slopeLen = run / c, L = zf - zb, ridge = eaveH + halfSpan * Math.tan(pitch);
    const pick = () => { const q = k.r(); return q < 0.72 || fabrics.length === 1 ? fabrics[0] : fabrics[1 + ((q * 7) | 0) % (fabrics.length - 1)]; };
    for (const side of [1, -1]) {
      const P = F.clone().multiply(basis(V(side * run, eaveH - ov * Math.tan(pitch), side > 0 ? zf : zb), V(0, 0, side > 0 ? -1 : 1), V(-side * c, s, 0)));
      k.cut(rect(0, 0, L, slopeLen + 0.03), null, P, under, { t: 0.04, amp: 0, bevel: 0.01 });           // the backing sheet
      const rows = Math.ceil(slopeLen / rowH);
      for (let j = 0; j < rows; j++) {
        const y0 = j * rowH, h = rowH * 1.55, z0 = 0.045 + j * 0.006;
        let x = -0.03 - k.r() * tile * 0.5;
        while (x < L + 0.02) {
          const w = tile * (0.78 + 0.45 * k.r()), xa = Math.max(-0.03, x), xb = Math.min(L + 0.03, x + w); x += w * 0.97;
          if (xb - xa < 0.06) continue;
          const u = ((xa + xb) / 2) / L, sagY = -sag * Math.sin(Math.PI * clamp(u)) * (j / rows);
          const cw = xb - xa, tab = [];
          if (shape === 'round') { tab.push([cw, h]); tab.push([0, h]); for (let q = 0; q <= 6; q++) { const a = Math.PI + (q / 6) * Math.PI; tab.push([cw / 2 + Math.cos(a) * cw / 2, cw * 0.32 + Math.sin(a) * cw * 0.32]); } }
          else { tab.push([0, 0.0], [cw, 0.0], [cw, h], [0, h]); }
          const fab = pick(), lift = k.r() < 0.18 ? 0.05 + k.r() * 0.05 : k.r() * 0.02;
          const T = P.clone().multiply(M([xa, y0 + sagY + (k.r() - 0.5) * 0.012, z0], [-lift, 0, (k.r() - 0.5) * 0.06]));
          k.cut(tab, null, T, fab.color, { batch: fab.batch || 'felt', extra: fab.extra || 0, t: 0.035, bevel: 0.01, amp: 0, seg: 1 });
        }
        // each row is sewn along its top edge to the backing (mostly hidden under the next row)
        k.S.running(P.clone().multiply(M([0, y0 + h - 0.06 - sag * 0.5 * (j / rows), z0 + 0.037])), [[0.08, 0], [L - 0.08, 0]], 0, thread, { len: 0.07, gap: 0.06, r: 0.007 });
      }
      if (snow) k.drape(P.clone().multiply(M([0, 0, 0.12 + rows * 0.006])), -0.05, L + 0.05, slopeLen * (1 - snowTop) + 0.15 * Math.sin(side * 1.3), slopeLen + 0.02, { thick: 0.22, edge: 0.45, rag: 0.4, res: 0.12 });
    }
    // the ridge: a strip of felt folded over the top and blanket-stitched down both sides
    const RS = 0.22;
    for (const side of [1, -1]) {
      const P = F.clone().multiply(basis(V(0, ridge + 0.11, zb - 0.05), V(0, 0, 1), V(side * c, -s, 0)));
      k.cut(rect(0, -0.02, L + 0.1, RS), null, P, ridgeCol ?? fabrics[0].color, { t: 0.035, bevel: 0.012, amp: 0.006, wave: 0.3 });
      k.S.blanket(P, rect(0, -0.02, L + 0.1, RS), 0.036, thread, { step: 0.1, depth: 0.04, r: 0.007 });
    }
    return { ridge, heightAt: (x) => ridge - Math.abs(x) * Math.tan(pitch) };
  };

  /** a window frame of painted wood strips: mitred at the corners, each strip a touch off true */
  k.woodFrame = (F, x0, y0, x1, y1, z, color, { w = 0.08, d = 0.05, sill = true } = {}) => {
    const strip = (ax, ay, bx, by) => { const L = Math.hypot(bx - ax, by - ay), a = Math.atan2(by - ay, bx - ax); k.solid(new THREE.BoxGeometry(L + w, w, d), F.clone().multiply(M([(ax + bx) / 2, (ay + by) / 2, z + d / 2], [0, 0, a + (k.r() - 0.5) * 0.012])), color, { batch: 'paint', smooth: false }); };
    strip(x0 - w / 2, y0 - w / 2, x1 + w / 2, y0 - w / 2); strip(x0 - w / 2, y1 + w / 2, x1 + w / 2, y1 + w / 2);
    strip(x0 - w / 2, y0, x0 - w / 2, y1); strip(x1 + w / 2, y0, x1 + w / 2, y1);
    if (sill) k.solid(new THREE.BoxGeometry(x1 - x0 + w * 3.2, 0.05, 0.16), F.clone().multiply(M([(x0 + x1) / 2, y0 - w, z + 0.08])), color, { batch: 'paint', smooth: false });
  };
  /** a window bound in cloth: a padded roll of bias binding around the opening, whip-stitched */
  k.boundFrame = (F, outline, z, color, thread, { r = 0.04 } = {}) => {
    const P = resample(ccw(outline), 0.05).map(([x, y]) => V(x, y, z + r * 0.6).applyMatrix4(F));
    k.yarnTube(P, r, color);
    const n = P.length; for (let i = 0; i < n; i += 2) { const a = P[i], b = P[(i + 1) % n], nrm = V(0, 0, 1).transformDirection(F); k.S.add(a.clone().addScaledVector(nrm, r * 0.9), b.clone().addScaledVector(nrm, -r * 0.2), thread, 0.006); }
  };
  /** a padded tube (binding, piping, kerbs) in woven cloth */
  k.yarnTube = (points, radius, color, { closed = true } = {}) => {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal'), L = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(12, Math.round(L / 0.05)), radius, 7, closed);
    k.solid(g, null, color, { batch: 'woven' });
  };

  /**
   * A felt fir: tiers of separate branch pieces (long leaves of felt, pinked along the edges) radiating from a dowel,
   * each tilted down and overlapping its neighbours, with a small felt cone at the top. Batting caught on the upper sides.
   */
  k.feltFir = (x, y, z, h, { R = null, tiers = 7, col = 0x2a5e3c, col2 = 0x24543a, light = 0x3c7a4c, seed = 1, snow = 0.6, dowel = true, batch = 'felt' } = {}) => {
    const r = rng(seed), RR = R ?? h * 0.36, base = M([x, y, z]);
    if (dowel) k.solid(new THREE.CylinderGeometry(0.045, 0.06, h * 0.32, 7), base.clone().multiply(M([0, h * 0.16, 0])), 0x6a4528, { batch: 'paint', smooth: false });
    for (let i = 0; i < tiers; i++) {
      const tt = i / (tiers - 1), Rt = RR * (1 - tt * 0.82) * (0.92 + 0.16 * r()) + 0.06, yt = h * 0.16 + tt * h * 0.76, n = Math.max(7, Math.round(8 + Rt * 9)), droop = 0.38 + 0.3 * (1 - tt);
      for (let b = 0; b < n; b++) {
        const a = (b / n) * TAU + i * 0.7 + (r() - 0.5) * 0.3, len = Rt * (0.8 + 0.3 * r()), wd = Math.min(len * 0.7, 0.18 + len * 0.32) * (0.9 + 0.2 * r());
        const leaf = []; const teeth = 5;
        for (let q = 0; q <= teeth * 2; q++) { const u = q / (teeth * 2), w = Math.sin(u * Math.PI) ** 0.8 * wd * 0.5 * (q % 2 ? 0.82 : 1); leaf.push([u * len, w]); }
        for (let q = teeth * 2 - 1; q > 0; q--) { const u = q / (teeth * 2), w = Math.sin(u * Math.PI) ** 0.8 * wd * 0.5 * (q % 2 ? 0.82 : 1); leaf.push([u * len, -w]); }
        const P = base.clone().multiply(M([0, yt, 0], [0, -a, 0])).multiply(M([0.03, 0, 0], [-Math.PI / 2, -droop - (r() - 0.5) * 0.15, (r() - 0.5) * 0.2]));
        k.cut(leaf, null, P, [col, col2, light][(b + i) % 3 === 2 && r() < 0.5 ? 2 : (b + i) % 2], { batch, t: 0.03, bevel: 0.009, amp: 0, seg: 1 });
        if (snow > 1 && r() < 0.1) k.lump(len * 0.18, wd * 0.16, 0.022, P.clone().multiply(M([len * (0.35 + 0.3 * r()), 0, 0.03])), 0xf7f4ee, { batch: 'batt', detail: 1, amp: 0.35 });
      }
    }
    const cone = new THREE.ConeGeometry(0.1 + RR * 0.06, h * 0.16, 9, 2); k.solid(cone, base.clone().multiply(M([0, h * 0.95, 0])), col, { batch });
  };

  /**
   * Street stones, each one cut separately, laid in courses that follow the street and change rhythm at its edges.
   * edges(x) → [yNear, yFar] (the street between two curbs, in the frame's xz plane); joints stay open to show the bed.
   */
  k.cutStones = (x0, x1, edges, { course = 0.36, stone = 0.46, y = 0.0, cols = [0x8c8590, 0x847e8a, 0x928b94, 0x8a8e9c, 0x8e857c, 0x968e92], seed = 3, skip = () => false, pillow = false } = {}) => {
    const r = rng(seed);
    for (let x = x0; x < x1;) {
      const [za, zb] = edges(x), width = zb - za, rows = Math.max(2, Math.round(width / course)), ch = width / rows;
      const colW = stone * (0.8 + 0.4 * r());
      for (let j = 0; j < rows; j++) {
        const edgeRow = j === 0 || j === rows - 1, w = edgeRow ? colW * 0.62 : colW, off = (j % 2) * colW * 0.5;
        for (let xx = x + (edgeRow ? 0 : off - colW * 0.5); xx < x + colW - 0.01; xx += w) {
          const sw = Math.min(w, x + colW - xx), cx = xx + sw / 2, cz = za + (j + 0.5) * ch;
          if (sw < 0.12 || skip(cx, cz)) continue;
          const hw = sw / 2 - 0.022, hd = ch / 2 - 0.024, rr = Math.min(hw, hd) * (0.35 + 0.4 * r());
          const out = handCut(roundRect(-hw, -hd, hw, hd, rr, 3), { amp: 0.008, wave: 0.18, step: 0.08, seed: (r() * 1e5) | 0 });
          if (pillow) k.pillow(out, 0.05, M([cx, y, cz], [-Math.PI / 2, 0, (r() - 0.5) * 0.08]), cols[(r() * cols.length) | 0], { batch: 'felt', rings: 3, flat: 3, under: 0.1, amp: 0, vary: 0.07 });   // the felt look: stuffed pebbles
          else k.panel(out, null, M([cx, y, cz], [-Math.PI / 2, 0, (r() - 0.5) * 0.08]), cols[(r() * cols.length) | 0], { batch: r() < 0.4 ? 'woven' : 'felt', t: 0.045, stuff: 0, amp: 0, roll: 0.6, vary: 0.07 });
        }
      }
      x += colW;
    }
  };
  return k;
}
