// Copied from experiment/textile-storybook @ d509733 (web/handmade/src). Kept as-is so the port can be traced;
// the project's own textile system builds on it in ../*.js.
// Experiment B — felt construction kit: soft-edged felt panels, stuffed pillows, lumpy needle-felted forms, and
// instanced stitches (running, blanket, satin, cross). Every stitch is a real little thread in 3D.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Batch, slab, handCut, resample, ccw, rng, V, M, prim, signedArea } from './kit.js';

export const FT = 0.085;                       // felt thickness in world units (≈ 3 mm at model scale)

// ------------------------------------------------------------------ JS 3D value noise (for lumpy shapes)
const hh = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
export function noise3(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hh(ix + dx, iy + dy, iz + dz, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), ux), L(c(0, 1, 0), c(1, 1, 0), ux), uy), L(L(c(0, 0, 1), c(1, 0, 1), ux), L(c(0, 1, 1), c(1, 1, 1), ux), uy), uz) * 2 - 1;
}
export const fbm3js = (x, y, z, s = 0, o = 3) => { let a = 0.5, t = 0, f = 1; for (let i = 0; i < o; i++) { t += a * noise3(x * f, y * f, z * f, s + i); f *= 2.03; a *= 0.5; } return t; };

// ------------------------------------------------------------------ geometry
/** a stuffed shape: the outline sewn flat at the seam, domed on top (flat = 2 dome … 6 cushion), slightly puffy under */
export function pillowGeo(outline, h, { rings = 5, under = 0.25, flat = 3, lump = 0, seed = 1, step = 0.05 } = {}) {
  const P = ccw(resample(outline, step)); const n = P.length;
  let cx = 0, cy = 0; for (const [x, y] of P) { cx += x; cy += y; } cx /= n; cy /= n;
  const pos = [], idx = [];
  const ring = (s, z) => { const base = pos.length / 3; for (const [x, y] of P) { const px = cx + (x - cx) * s, py = cy + (y - cy) * s; const l = lump ? 1 + lump * noise3(px * 3.1, py * 3.1, z * 2 + seed, seed) : 1; pos.push(px, py, z * l); } return base; };
  const prof = (s) => Math.pow(Math.max(0, 1 - Math.pow(s, flat)), 0.5);
  const rim = ring(1, 0);
  const sideRings = (sign, hh2) => {
    let prev = rim; const ids = [];
    for (let k = 1; k < rings; k++) { const s = 1 - k / rings, b = ring(s, sign * hh2 * prof(s)); ids.push([prev, b]); prev = b; }
    const c = pos.length / 3; pos.push(cx, cy, sign * hh2 * (lump ? 1 + lump * noise3(cx, cy, seed, seed) : 1));
    for (const [a, b] of ids) for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (sign > 0) idx.push(a + i, a + j, b + j, a + i, b + j, b + i); else idx.push(a + i, b + j, a + j, a + i, b + i, b + j); }
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (sign > 0) idx.push(prev + i, prev + j, c); else idx.push(prev + i, c, prev + j); }
  };
  sideRings(1, h); sideRings(-1, h * under);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** a needle-felted fir: one firm felted cone with drooping tiers (a sawtooth lathe profile), pushed about by noise */
export function firGeo(h, R, { tiers = 6, seg = 40, seed = 1, droop = 0.55, lumpAmp = 0.06 } = {}) {
  const prof = []; const N = tiers * 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N, tier = Math.min(tiers - 1, Math.floor(t * tiers)), f = t * tiers - tier, cone = R * (1 - t) ** 0.95;
    const flare = f < 0.18 ? f / 0.18 : 1 - (f - 0.18) / 0.82;      // each tier flares out at its bottom edge, then tucks in
    prof.push(new THREE.Vector2(Math.max(0.01, cone * (1 - droop * 0.5 + droop * 0.5 * flare)), t * h - (f < 0.18 ? 0.04 * (1 - f / 0.18) : 0)));
  }
  prof.push(new THREE.Vector2(0.0, h + 0.02));
  prof.unshift(new THREE.Vector2(0.0, -0.02));
  let g = new THREE.LatheGeometry(prof, seg); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z); if (rr < 1e-3) continue;
    const a = Math.atan2(z, x), n = fbm3js(Math.cos(a) * 1.6, y * 1.4, Math.sin(a) * 1.6, seed) * lumpAmp + 0.04 * Math.sin(a * 7 + y * 3.0) * (rr / R);
    const k = 1 + n / Math.max(0.2, rr); p.setXYZ(i, x * k, y, z * k);
  }
  g.computeVertexNormals();
  return g;
}
/** a needle-felted lump: a noisy sphere, then squashed/stretched */
export function lumpGeo(sx, sy, sz, { detail = 3, amp = 0.18, freq = 1.6, seed = 1 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail); g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + amp * fbm3js(x * freq, y * freq, z * freq, seed);
    p.setXYZ(i, x * d * sx, y * d * sy, z * d * sz);
  }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ stitches
const _y = V(0, 1, 0), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _c = new THREE.Color();
export class StitchSet {
  constructor(seed = 5) { this.items = []; this.r = rng(seed); }
  add(p0, p1, color, r = 0.0085) { this.items.push([p0, p1, color, r]); }
  /** one stitch between two points given in a panel frame F (x, y on the face, z off the face) */
  addLocal(F, a, b, color, r) { this.add(V(...a).applyMatrix4(F), V(...b).applyMatrix4(F), color, r); }
  /** running stitch along a polyline (2D in F's plane, at height z) */
  running(F, pts, z, color, { closed = false, len = 0.07, gap = 0.045, r = 0.0085, jitter = 0.006 } = {}) {
    const P = closed ? [...pts, pts[0]] : pts; let carry = 0, on = true;
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1], L = Math.hypot(x1 - x0, y1 - y0); let t = carry;
      while (t < L) {
        const seg = on ? len : gap, t1 = Math.min(L, t + seg);
        if (on && t1 - t > seg * 0.4) { const j = () => (this.r() - 0.5) * jitter; this.addLocal(F, [x0 + (x1 - x0) * t / L + j(), y0 + (y1 - y0) * t / L + j(), z], [x0 + (x1 - x0) * t1 / L + j(), y0 + (y1 - y0) * t1 / L + j(), z], color, r); }
        if (t1 >= L && t + seg > L) { carry = t + seg - L; if (on) carry = 0; break; }
        t = t1; on = !on;
      }
    }
  }
  /** blanket stitch around a closed outline: legs from inside the face out over the edge, linked along the rim */
  blanket(F, outline, z, color, { step = 0.075, depth = 0.06, r = 0.0085, over = 0.03 } = {}) {
    const P = resample(ccw(outline), step / 3); const n = P.length; let acc = 0, last = null;
    const sgn = signedArea(P) >= 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const [x, y] = P[i], [xa, ya] = P[(i - 1 + n) % n], [xb, yb] = P[(i + 1) % n];
      acc += Math.hypot(x - xa, y - ya); if (i && acc < step) continue; acc = 0;
      let tx = xb - xa, ty = yb - ya; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const nx = ty * sgn, ny = -tx * sgn;   // outward
      const inner = [x - nx * depth, y - ny * depth, z], rim = [x + nx * 0.006, y + ny * 0.006, z + 0.004], side = [x + nx * (0.012 + r), y + ny * (0.012 + r), z - over];
      this.addLocal(F, inner, rim, color, r); this.addLocal(F, rim, side, color, r * 0.9);
      if (last) this.addLocal(F, last, rim, color, r * 0.9);
      last = rim;
    }
  }
  /** satin stitch: a band of tight parallel stitches across the path (embroidered letters, glazing bars) */
  satin(F, pts, z, color, { width = 0.06, spacing = 0.016, r = 0.007, slant = 0.25 } = {}) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), tx = (x1 - x0) / L, ty = (y1 - y0) / L, nx = -ty, ny = tx;
      for (let t = 0; t <= L; t += spacing) {
        const cx = x0 + tx * t, cy = y0 + ty * t, sl = slant * width;
        this.addLocal(F, [cx - nx * width / 2 - tx * sl / 2, cy - ny * width / 2 - ty * sl / 2, z], [cx + nx * width / 2 + tx * sl / 2, cy + ny * width / 2 + ty * sl / 2, z + 0.004], color, r);
      }
    }
  }
  cross(F, x, y, z, s, color, r = 0.008) { this.addLocal(F, [x - s, y - s, z], [x + s, y + s, z + 0.003], color, r); this.addLocal(F, [x - s, y + s, z + 0.003], [x + s, y - s, z], color, r); }
  /** a sewn-on button: a domed disc is geometry (added by the caller); these are the two crossed threads */
  buttonThread(F, x, y, z, s, color) { this.cross(F, x, y, z, s * 0.35, color, 0.006); }
  build(material) {
    const geo = new THREE.CapsuleGeometry(0.5, 1, 1, 4);
    const im = new THREE.InstancedMesh(geo, material, this.items.length);
    this.items.forEach(([p0, p1, col, r], i) => {
      const d = p1.clone().sub(p0), L = Math.max(d.length(), 1e-4);
      _q.setFromUnitVectors(_y, d.multiplyScalar(1 / L));
      _m.compose(p0.clone().add(p1).multiplyScalar(0.5), _q, V(2 * r, L / 2 + r * 0.6, 2 * r));
      im.setMatrixAt(i, _m); im.setColorAt(i, _c.set(col).offsetHSL(0, 0, (this.r() - 0.5) * 0.04));
    });
    im.castShadow = true; im.receiveShadow = true; im.name = 'stitches'; im.userData.helperSkip = true;
    im.computeBoundingSphere();
    return im;
  }
}

// ------------------------------------------------------------------ the kit
export function makeFeltKit(seed = 11) {
  const r = rng(seed);
  const B = { felt: new Batch('felt', seed), flat: new Batch('feltFlat', seed + 5), glow: new Batch('glowFelt', seed + 1), wool: new Batch('wool', seed + 2), bead: new Batch('beads', seed + 3), metal: new Batch('metal', seed + 4) };
  const S = new StitchSet(seed + 9);
  const sd = () => (r() * 1e6) | 0;
  // pieces with no fuzz (far away, or hidden) skip the shell pass entirely
  const route = (batch, fuzz) => (batch === 'felt' && fuzz <= 0 ? 'flat' : batch);
  /** a piece of felt: soft rounded edge, slightly ragged scissor line */
  function cut(outline, holes, matrix, color, { t = FT, bevel = null, amp = 0.01, wave = 0.22, rag = 0, batch = 'felt', fuzz = 1, vary = 0.05 } = {}) {
    const o = handCut(outline, { amp, wave, tear: rag, tearWave: 0.04, seed: sd() });
    const hs = (holes || []).map((h) => handCut(h, { amp: amp * 0.6, wave: 0.18, tear: rag * 0.7, tearWave: 0.04, seed: sd() }));
    const g = slab(o, hs, t, { bevel: bevel ?? t * 0.38, bevelSeg: 2, smoothNormals: true });
    B[route(batch, fuzz)].add(g, matrix, color, { vary, extra: fuzz });
    return o;
  }
  function pillow(outline, h, matrix, color, { batch = 'felt', fuzz = 1, vary = 0.05, amp = 0.008, ...o } = {}) {
    const ol = amp ? handCut(outline, { amp, wave: 0.2, seed: sd() }) : outline;
    B[route(batch, fuzz)].add(pillowGeo(ol, h, { seed: sd() % 997, ...o }), matrix, color, { vary, extra: fuzz });
    return ol;
  }
  function lump(sx, sy, sz, matrix, color, { batch = 'felt', fuzz = 1, vary = 0.05, ...o } = {}) {
    B[route(batch, fuzz)].add(lumpGeo(sx, sy, sz, { seed: sd() % 997, ...o }), matrix, color, { vary, extra: fuzz });
  }
  function solid(geo, matrix, color, { batch = 'felt', fuzz = 1, vary = 0.04, smooth = true } = {}) {
    let g = geo; if (smooth) { for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g = mergeVertices(g); g.computeVertexNormals(); }
    B[route(batch, fuzz)].add(g, matrix, color, { vary, extra: fuzz });
  }
  /** a sewing button: domed disc with holes suggested by the thread cross */
  function button(F, x, y, z, s, color, thread = 0xf3e7d2) {
    const g = new THREE.CylinderGeometry(s, s * 1.05, s * 0.35, 18); g.rotateX(Math.PI / 2);
    B.metal.add(prim(g), F.clone().multiply(M([x, y, z + s * 0.17])), color, { vary: 0.02 });
    S.buttonThread(F, x, y, z + s * 0.37, s, thread);
  }
  return { r, B, S, cut, pillow, lump, solid, button, sd };
}
