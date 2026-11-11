// Copied from experiment/textile-storybook @ d509733 (web/handmade/src). Kept as-is so the port can be traced;
// the project's own textile system builds on it in ../*.js.
// Shared construction kit for the handmade-style experiments.
//
// Everything in both styles is built the way a model-maker would build it: flat stock (card, felt)
// is cut along an outline, given real thickness, and placed in 3D. This file holds the pieces that
// are common to both: seeded randomness, hand-cut outlines (a perfect polygon resampled and nudged by
// smooth noise, like scissors that wander), extrusion, and a batcher that merges hundreds of pieces into a
// handful of draw calls while keeping per-piece colour, an "edge" channel and a random seed per piece.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ randomness
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  const f = () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.range = (a, b) => a + (b - a) * f();
  f.sign = () => (f() < 0.5 ? -1 : 1);
  f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
  return f;
}
const hash1 = (i, seed) => { let h = Math.imul((i | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
/** smooth 1D value noise in [-1, 1] */
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (lerp(hash1(i, seed), hash1(i + 1, seed), u)) * 2 - 1;
}
/** periodic 1D noise (for closed outlines, so the wobble joins up seamlessly) */
function noiseLoop(t, period, seed) {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  const a = hash1(((i % period) + period) % period, seed), b = hash1((((i + 1) % period) + period) % period, seed);
  return lerp(a, b, u) * 2 - 1;
}

// ------------------------------------------------------------------ outlines (arrays of [x, y], counter-clockwise)
export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export function roundRect(x0, y0, x1, y1, r, seg = 4) {
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const out = [], c = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
export function circle(cx, cy, r, n = 24, a0 = 0) { const o = []; for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
export function ellipse(cx, cy, rx, ry, n = 24) { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
/** arched window/door opening: rectangle with a semicircular top */
export function arch(x0, y0, x1, y1, seg = 12) {
  const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, cy = y1 - r, o = [[x0, y0], [x1, y0]];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return o;
}
export function star(cx, cy, r0, r1, n = 5, a0 = Math.PI / 2) { const o = []; for (let i = 0; i < n * 2; i++) { const a = a0 + (i / (n * 2)) * TAU, r = i % 2 ? r1 : r0; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
export const signedArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
export const ccw = (p) => (signedArea(p) < 0 ? p.slice().reverse() : p);
export const translate2 = (p, dx, dy) => p.map(([x, y]) => [x + dx, y + dy]);
export const scale2 = (p, sx, sy = sx, cx = 0, cy = 0) => p.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
export const rotate2 = (p, a, cx = 0, cy = 0) => { const c = Math.cos(a), s = Math.sin(a); return p.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); };

/** resample a closed polygon so no edge is longer than `step` (corners are kept exactly) */
export function resample(p, step) {
  const o = [];
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) o.push([lerp(x0, x1, k / n), lerp(y0, y1, k / n)]);
  }
  return o;
}
/**
 * A hand-cut version of an outline: points are pushed in and out along the outline's normal by smooth noise
 * (amp = how far the blade wanders, wave = how long each wander is), plus optional fine "tear" noise for torn
 * paper or ragged felt. Closed outlines get periodic noise so the start and end meet.
 */
export function handCut(p, { amp = 0.006, wave = 0.35, tear = 0, tearWave = 0.03, step, seed = 1 } = {}) {
  let per0 = 0; for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; per0 += Math.hypot(x1 - x0, y1 - y0); }
  const pts = resample(p, Math.max(step || Math.min(wave, tear ? tearWave : wave) / 2.5, per0 / 420));
  const n = pts.length; let L = 0; const s = [0];
  for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n]; L += Math.hypot(x1 - x0, y1 - y0); s.push(L); }
  const per = Math.max(3, Math.round(L / wave)), perT = Math.max(3, Math.round(L / tearWave)), sgn = signedArea(pts) >= 0 ? 1 : -1;
  return pts.map(([x, y], i) => {
    const [xa, ya] = pts[(i - 1 + n) % n], [xb, yb] = pts[(i + 1) % n];
    let tx = xb - xa, ty = yb - ya; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const nx = ty * sgn, ny = -tx * sgn;                        // outward normal
    const u = (s[i] / L);
    let d = amp * noiseLoop(u * per, per, seed) + amp * 0.35 * noiseLoop(u * per * 3, per * 3, seed + 7);
    if (tear) d += tear * (noiseLoop(u * perT, perT, seed + 3) * 0.7 + noiseLoop(u * perT * 2.7, Math.round(perT * 2.7), seed + 11) * 0.3);
    return [x + nx * d, y + ny * d];
  });
}

// ------------------------------------------------------------------ extrusion
/** make a THREE.Shape from an outer outline and holes (orientation is fixed up) */
export function shapeOf(outer, holes = []) {
  const s = new THREE.Shape(ccw(outer).map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(ccw(h).reverse().map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}
/**
 * Extrude an outline into a slab of thickness `depth` (front face at z = depth, back at 0, or centred).
 * bevel > 0 gives the soft rolled edge of felt; 0 gives the crisp cut edge of card.
 * Returns a non-indexed geometry with position + normal only (attributes are added by the Batch).
 */
export function slab(outer, holes, depth, { bevel = 0, bevelSeg = 3, center = false, smoothNormals = false } = {}) {
  const g = new THREE.ExtrudeGeometry(shapeOf(outer, holes || []), {
    depth: Math.max(1e-4, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9,
    bevelOffset: -bevel * 0.9, bevelSegments: bevelSeg, curveSegments: 1, steps: 1,
  });
  g.translate(0, 0, bevel - (center ? depth / 2 : 0));
  g.deleteAttribute('uv');
  let out = g.index ? g.toNonIndexed() : g;
  if (smoothNormals) { out.deleteAttribute('normal'); out = mergeVertices(out, 1e-4); out.computeVertexNormals(); out = out.toNonIndexed(); }
  else out.computeVertexNormals();
  return out;
}
/** a generic geometry (box, sphere...) stripped down to position + normal, non-indexed */
export function prim(g, smoothNormals = true) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  let out = g.index ? g.toNonIndexed() : g;
  if (!smoothNormals) out.computeVertexNormals();
  return out;
}

// ------------------------------------------------------------------ placement
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
/** matrix from position, Euler rotation (radians, XYZ) and scale */
export function M(pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ'));
  return m.compose(Array.isArray(pos) ? V(...pos) : pos, _q, typeof scl === 'number' ? V(scl, scl, scl) : V(...scl));
}
/** matrix that maps the panel's local XY plane onto a plane with origin o, x-axis u and y-axis v (normal = u × v) */
export function basis(o, u, v) {
  u = u.clone().normalize(); v = v.clone().normalize(); const n = new THREE.Vector3().crossVectors(u, v).normalize();
  return new THREE.Matrix4().makeBasis(u, v, n).setPosition(o);
}

// ------------------------------------------------------------------ batching
const _c = new THREE.Color();
/**
 * Collects pieces for one material and merges them. Every vertex carries:
 *   color   the stock's colour (with a tiny per-piece variation — no two sheets are identical)
 *   aEdge   1 on cut edges / sides, 0 on the faces (computed from the piece's own normal before placement)
 *   aSeed   a random number per piece (the shaders use it to offset texture and tint)
 *   aExtra  a free per-piece channel (e.g. felt fuzz length, paper translucency)
 */
export class Batch {
  constructor(name, seed = 1) { this.name = name; this.parts = []; this.r = rng(seed); }
  add(geo, matrix, color, { vary = 0.04, extra = 0, edgeAxis = 'z', edge: forceEdge = null } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'aUv') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, nrm = g.attributes.normal;
    const edge = new Float32Array(n), seed = new Float32Array(n).fill(this.r()), ex = new Float32Array(n).fill(extra), col = new Float32Array(n * 3);
    if (forceEdge !== null) edge.fill(forceEdge);
    else for (let i = 0; i < n; i++) edge[i] = 1 - Math.abs(edgeAxis === 'z' ? nrm.getZ(i) : edgeAxis === 'y' ? nrm.getY(i) : nrm.getX(i));
    _c.set(color);
    if (vary) { const k = 1 + (this.r() - 0.5) * 2 * vary, h = (this.r() - 0.5) * vary * 0.25; _c.offsetHSL(h, 0, 0).multiplyScalar(k); }
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aExtra', new THREE.BufferAttribute(ex, 1));
    if (matrix) g.applyMatrix4(matrix);
    this.parts.push(g);
    return g;
  }
  get count() { return this.parts.length; }
  build() {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false); this.parts.length = 0;
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  mesh(material, { cast = true, receive = true } = {}) {
    const g = this.build(); if (!g) return null;
    const m = new THREE.Mesh(g, material); m.name = this.name; m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
}

// ------------------------------------------------------------------ GLSL shared by both styles
export const GLSL_NOISE = /* glsl */`
float hh3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hh3(i),hh3(i+vec3(1,0,0)),f.x),mix(hh3(i+vec3(0,1,0)),hh3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hh3(i+vec3(0,0,1)),hh3(i+vec3(1,0,1)),f.x),mix(hh3(i+vec3(0,1,1)),hh3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vn3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
// bump the shading normal by the screen-space gradient of a height field (no UVs or tangents needed)
vec3 bumpN(vec3 n, vec3 viewPos, float h, float amp){
  vec3 dpx = dFdx(viewPos), dpy = dFdy(viewPos);
  float dhx = dFdx(h)*amp, dhy = dFdy(h)*amp;
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  return normalize(abs(det) * n - sign(det) * (dhx * r1 + dhy * r2));
}
`;

/** curl a flat piece (in its local frame, before placement): z += k·x² (+ ky·y²), so card sags and cups like real paper */
export function bend(g, kx = 0, ky = 0, x0 = 0, y0 = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) - x0, y = p.getY(i) - y0; p.setZ(i, p.getZ(i) + kx * x * x + ky * y * y); }
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ tileable surface textures (generated once, mip-mapped)
/** periodic 2D value-noise fbm sampled on an n×n grid (tiles seamlessly) */
export function periodicFbm(n, baseCells, octaves, seed = 1, gain = 0.5) {
  const out = new Float32Array(n * n); let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o, r = rng(seed + o * 101), grid = new Float32Array(cells * cells);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    for (let y = 0; y < n; y++) {
      const fy = (y / n) * cells, iy = Math.floor(fy), ty = fy - iy, uy = ty * ty * (3 - 2 * ty), y0 = iy % cells, y1 = (iy + 1) % cells;
      for (let x = 0; x < n; x++) {
        const fx = (x / n) * cells, ix = Math.floor(fx), tx = fx - ix, ux = tx * tx * (3 - 2 * tx), x0 = ix % cells, x1 = (ix + 1) % cells;
        const a = grid[y0 * cells + x0], b = grid[y0 * cells + x1], c = grid[y1 * cells + x0], d = grid[y1 * cells + x1];
        out[y * n + x] += amp * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
      }
    }
    total += amp; amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
/** draw wrapped strokes onto a 2D canvas context (so fibres continue across the tile edge) */
export function wrapStroke(g, n, fn) { for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.save(); g.translate(dx, dy); fn(g); g.restore(); } }
/** pack channels (Float32Array 0..1 each, or null) into a mip-mapped repeating texture */
export function packTexture(n, chans) {
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = chans[c] ? Math.max(0, Math.min(255, Math.round(chans[c][i] * 255))) : 255;
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  return t;
}
/** read back a canvas channel as floats */
export function canvasChannel(cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, o = new Float32Array(cv.width * cv.height); for (let i = 0; i < o.length; i++) o[i] = d[i * 4] / 255; return o; }

// triplanar sampling in object space: weights from the object normal, three planar projections
export const GLSL_TRIPLANAR = /* glsl */`
vec4 triplanar(sampler2D t, vec3 p, vec3 n, float s){
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(t, p.yz * s) * w.x + texture2D(t, p.xz * s + 0.37) * w.y + texture2D(t, p.xy * s + 0.71) * w.z;
}
`;
