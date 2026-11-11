// Copied from experiment/textile-storybook @ d509733 (web/handmade/src). Kept as-is so the port can be traced;
// the project's own textile system builds on it in ../*.js.
// Experiment C — construction kit for the mixed-media textile storybook.
//   cut()      a piece of felt / woven cloth / card: hand-cut outline, real thickness (rolled edge for cloth, crisp for card)
//   pillow()   a stuffed shape (sewn flat at the seam, domed on top)
//   drape()    cotton batting laid over a surface: a soft heightfield with an irregular, tapering edge
//   stitches   one instanced draw for every stitch in the scene, 8 triangles each, lying flat on the cloth
//   yarn()     twisted yarn on a curve
// Every piece gets UVs projected on the CPU from its own flat frame, so the fabric's grain follows the cut.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, slab, handCut, resample, ccw, rng, V, M, prim, signedArea } from './kit.js';
import { pillowGeo, lumpGeo, fbm3js, noise3 } from './felt_kit.js';
import { yarnMaterial } from './textile_materials.js';

export const TF = 0.07;     // wool felt thickness (world units)

/** per-triangle planar UVs from the piece's own coordinates (before it is placed) */
function planarUV(g) {
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2), a = V(), b = V(), c = V(), e1 = V(), e2 = V(), fn = V();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    fn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
    for (let j = 0; j < 3; j++) {
      const x = p.getX(i + j), y = p.getY(i + j), z = p.getZ(i + j);
      const [u, v] = az >= ax && az >= ay ? [x, y] : ay >= ax ? [x, z] : [z, y];
      uv[(i + j) * 2] = u; uv[(i + j) * 2 + 1] = v;
    }
  }
  g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export class TBatch extends Batch {
  add(geo, matrix, color, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    planarUV(g);
    return super.add(g, matrix, color, o);
  }
}

// ------------------------------------------------------------------ stitches: tiny flattened bipyramids, instanced
const _y = V(0, 1, 0), _m = new THREE.Matrix4(), _c = new THREE.Color();
export class Stitches {
  constructor(seed = 5) { this.items = []; this.r = rng(seed); }
  add(p0, p1, color, r = 0.009, n = null) { this.items.push([p0, p1, color, r, n]); }
  addLocal(F, a, b, color, r) { const n = V(0, 0, 1).transformDirection(F); this.add(V(...a).applyMatrix4(F), V(...b).applyMatrix4(F), color, r, n); }
  running(F, pts, z, color, { closed = false, len = 0.065, gap = 0.045, r = 0.009, jitter = 0.005 } = {}) {
    const P = closed ? [...pts, pts[0]] : pts; let on = true, t = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
      while (t < L) {
        const seg = on ? len : gap, t1 = Math.min(L, t + seg);
        if (on && t1 - t > len * 0.45) { const j = () => (this.r() - 0.5) * jitter; this.addLocal(F, [x0 + (x1 - x0) * t / L + j(), y0 + (y1 - y0) * t / L + j(), z], [x0 + (x1 - x0) * t1 / L + j(), y0 + (y1 - y0) * t1 / L + j(), z], color, r); }
        if (t + seg > L) { t = t + seg - L; break; }
        t = t1; on = !on;
      }
    }
  }
  /** whip / blanket stitch along an outline: legs from the face out over the edge */
  blanket(F, outline, z, color, { step = 0.08, depth = 0.05, r = 0.009 } = {}) {
    const P = resample(ccw(outline), step / 3), n = P.length, sgn = signedArea(P) >= 0 ? 1 : -1; let acc = 0, last = null;
    for (let i = 0; i < n; i++) {
      const [x, y] = P[i], [xa, ya] = P[(i - 1 + n) % n], [xb, yb] = P[(i + 1) % n];
      acc += Math.hypot(x - xa, y - ya); if (i && acc < step) continue; acc = 0;
      let tx = xb - xa, ty = yb - ya; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const nx = ty * sgn, ny = -tx * sgn;
      const rim = [x + nx * 0.004, y + ny * 0.004, z];
      this.addLocal(F, [x - nx * depth, y - ny * depth, z], rim, color, r);
      if (last) this.addLocal(F, last, rim, color, r * 0.9);
      last = rim;
    }
  }
  /** satin stitch: tight parallel stitches across a path */
  satin(F, pts, z, color, { width = 0.05, spacing = 0.012, r = 0.007, slant = 0.3 } = {}) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L, nx = -ty, ny = tx;
      for (let t = 0; t <= L; t += spacing) { const cx = x0 + tx * t, cy = y0 + ty * t, sl = slant * width; this.addLocal(F, [cx - nx * width / 2 - tx * sl / 2, cy - ny * width / 2 - ty * sl / 2, z], [cx + nx * width / 2 + tx * sl / 2, cy + ny * width / 2 + ty * sl / 2, z], color, r); }
    }
  }
  /** lazy-daisy flower: petal loops round a French-knot centre */
  daisy(F, x, y, z, s, petal, centre, n = 5) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.3; this.addLocal(F, [x + Math.cos(a) * s * 0.25, y + Math.sin(a) * s * 0.25, z], [x + Math.cos(a) * s, y + Math.sin(a) * s, z], petal, s * 0.22); }
    this.addLocal(F, [x - s * 0.08, y, z + 0.003], [x + s * 0.08, y, z + 0.003], centre, s * 0.22);
  }
  knot(F, x, y, z, s, color) { this.addLocal(F, [x - s * 0.4, y, z], [x + s * 0.4, y, z + 0.002], color, s); }
  cross(F, x, y, z, s, color, r = 0.008) { this.addLocal(F, [x - s, y - s, z], [x + s, y + s, z], color, r); this.addLocal(F, [x - s, y + s, z], [x + s, y - s, z], color, r); }
  /** the same stitches as one plain geometry with vertex colours (for skinned characters) */
  geometry() {
    const base = new THREE.OctahedronGeometry(0.5, 0); base.deleteAttribute('uv');
    const parts = [], X = V(), Y = V(), Z = V();
    for (const [p0, p1, col, r, n] of this.items) {
      Y.subVectors(p1, p0); const L = Math.max(Y.length(), 1e-4); Y.multiplyScalar(1 / L);
      Z.copy(n || V(0, 0, 1)); Z.addScaledVector(Y, -Z.dot(Y)); if (Z.lengthSq() < 1e-6) Z.set(Y.y, -Y.x, 0); Z.normalize(); X.crossVectors(Y, Z);
      const g = base.clone().applyMatrix4(new THREE.Matrix4().makeBasis(X.clone().multiplyScalar(2 * r), Y.clone().multiplyScalar(L + r), Z.clone().multiplyScalar(1.3 * r)).setPosition(p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(Z, r * 0.25)));
      g.computeVertexNormals(); _c.set(col); const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = _c.r; c[i + 1] = _c.g; c[i + 2] = _c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g);
    }
    return parts.length ? mergeGeometries(parts) : null;
  }
  build(material) {
    const geo = new THREE.OctahedronGeometry(0.5, 0); geo.deleteAttribute('uv');
    const im = new THREE.InstancedMesh(geo, material, this.items.length), X = V(), Y = V(), Z = V();
    this.items.forEach(([p0, p1, col, r, n], i) => {
      Y.subVectors(p1, p0); const L = Math.max(Y.length(), 1e-4); Y.multiplyScalar(1 / L);
      Z.copy(n || V(0, 0, 1)); Z.addScaledVector(Y, -Z.dot(Y)); if (Z.lengthSq() < 1e-6) Z.set(Y.y, -Y.x, 0); Z.normalize(); X.crossVectors(Y, Z);
      _m.makeBasis(X.clone().multiplyScalar(2 * r), Y.clone().multiplyScalar(L + r), Z.clone().multiplyScalar(1.3 * r)).setPosition(p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(Z, r * 0.25));
      im.setMatrixAt(i, _m); im.setColorAt(i, _c.set(col).offsetHSL(0, 0, (this.r() - 0.5) * 0.04));
    });
    im.castShadow = false; im.receiveShadow = true; im.name = 'stitches'; im.userData.helperSkip = true; im.computeBoundingSphere();
    return im;
  }
}

// ------------------------------------------------------------------ batting drape: a soft heightfield over a frame's XY rectangle
/**
 * Cotton batting laid over a surface (frame F, local z = up off the surface). The edge is irregular (noise), the pile
 * tapers to nothing there and tucks under (so it never floats), and lumps where it was pulled and patted down.
 * droop: length of the overhang below y0 (it bends down over the edge by `droopAngle`).
 */
export function drapeGeo(x0, x1, y0, y1, { thick = 0.14, res = 0.12, seed = 1, edge = 0.28, rag = 0.22, droop = 0, droopAngle = 1.2, sink = 0.05 } = {}) {
  const nx = Math.max(2, Math.round((x1 - x0) / res)), ny = Math.max(2, Math.round((y1 - y0 + droop) / res)), pos = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, y = (y0 - droop) + (y1 - y0 + droop) * j / ny;
    // distance to the (noisy) edge of the patch, in metres
    const dEdge = Math.min(x - x0, x1 - x, (y - (y0 - droop)), y1 - y) + rag * fbm3js(x * 1.3, y * 1.3, seed, seed);
    const m = Math.max(0, Math.min(1, dEdge / edge)), mm = m * m * (3 - 2 * m);
    const lumps = 0.55 + 0.9 * fbm3js(x * 1.9, y * 1.9, seed + 5, seed + 1) + 0.25 * fbm3js(x * 6.0, y * 6.0, seed + 9, seed + 2);
    let z = thick * mm * lumps - sink * (1 - mm), yy = y;
    if (y < y0) { const R = Math.max(droop, 1e-3) / droopAngle, th = (y0 - y) / R; yy = y0 - R * Math.sin(th); z += -R * (1 - Math.cos(th)); }
    pos.push(x, yy, z);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ the kit
export function makeKit(seed = 21) {
  const r = rng(seed);
  const names = ['felt', 'woven', 'print', 'batt', 'paint', 'glow', 'card', 'metal', 'bead'];
  const B = {}; names.forEach((n, i) => { B[n] = new TBatch(n, seed + i * 3); });
  const S = new Stitches(seed + 99);
  const yarns = [];
  const sd = () => (r() * 1e6) | 0;
  /** felt / cloth / card piece */
  function cut(outline, holes, matrix, color, { t = TF, bevel = null, amp = 0.012, wave = 0.3, batch = 'felt', extra = 0, vary = 0.05, seg = 2 } = {}) {
    const o = amp ? handCut(outline, { amp, wave, seed: sd() }) : outline;
    const hs = (holes || []).map((h) => (amp ? handCut(h, { amp: amp * 0.6, wave: 0.2, seed: sd() }) : h));
    const crisp = batch === 'card';
    const g = slab(o, hs, t, { bevel: crisp ? 0 : (bevel ?? t * 0.32), bevelSeg: crisp ? 0 : seg, smoothNormals: !crisp });
    B[batch].add(g, matrix, color, { vary, extra });
    return o;
  }
  function pillow(outline, h, matrix, color, { batch = 'felt', extra = 0, vary = 0.05, amp = 0.008, ...o } = {}) {
    const ol = amp ? handCut(outline, { amp, wave: 0.2, seed: sd() }) : outline;
    B[batch].add(pillowGeo(ol, h, { seed: sd() % 997, ...o }), matrix, color, { vary, extra });
    return ol;
  }
  function lump(sx, sy, sz, matrix, color, { batch = 'felt', extra = 0, vary = 0.04, ...o } = {}) { B[batch].add(lumpGeo(sx, sy, sz, { seed: sd() % 997, ...o }), matrix, color, { vary, extra }); }
  function solid(geo, matrix, color, { batch = 'felt', extra = 0, vary = 0.04, smooth = true } = {}) {
    let g = geo; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
    if (smooth) { g = mergeVertices(g); } g.computeVertexNormals();
    B[batch].add(g, matrix, color, { vary, extra });
  }
  function drape(F, x0, x1, y0, y1, o = {}) { B.batt.add(drapeGeo(x0, x1, y0, y1, { seed: sd() % 97, ...o }), F, o.color || 0xf7f4ee, { vary: 0.015 }); }
  /** a sewing button (wood or metal): a domed disc and its thread cross */
  function button(F, x, y, z, s, color, { batch = 'paint', thread = 0xf3e7d2 } = {}) {
    const g = new THREE.CylinderGeometry(s, s * 1.05, s * 0.4, 14); g.rotateX(Math.PI / 2);
    B[batch].add(prim(g), F.clone().multiply(M([x, y, z + s * 0.2])), color, { vary: 0.03 });
    S.cross(F, x, y, z + s * 0.42, s * 0.3, thread, s * 0.12);
  }
  function yarn(points, radius, color, { closed = false } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal'), L = curve.getLength();
    const g = new THREE.TubeGeometry(curve, Math.max(16, Math.round(L / 0.03)), radius, 6, closed);
    yarns.push({ g, color, twists: L / (radius * 3.2) });
  }
  return { r, B, S, cut, pillow, lump, solid, drape, button, yarn, yarns, sd };
}
export { noise3, fbm3js, lumpGeo, pillowGeo };
