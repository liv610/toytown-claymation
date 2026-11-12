// Picture-map landmarks for the felt national map (session 2 of the owner's reference): big stuffed felt mountains with
// batting snow, clusters of large felt firs, cottages and a farm with lit windows, saguaro cacti, red-rock mesas,
// lighthouses, palm trees, a moose and an adobe mission — exaggerated in size like an illustrated map, placed by real
// longitude / latitude. Each kind is ONE instanced draw (geometry with vertex colours + a glow mesh for its windows),
// so a hundred pieces cost about as much as one. They are icons of the map view: they shrink back and fade as the
// camera comes down to a town (iconScale, set by the page), so a story town keeps its real size.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geoAlbers } from 'd3-geo';
import { felt } from './felt.js';
import { MAP_W, MAP_H, fbm } from './geo.js';

const A48 = geoAlbers().scale(1300).translate([487.5, 305]);
export const iconScale = { value: 1 };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- geometry helpers (all end up non-indexed, coloured)
function paint(g, hex) {
  g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
function lumpy(g, amp, f = 0.6, seed = 0) {   // a soft, hand-stuffed wobble along the normals (on the indexed mesh: stays smooth)
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = (fbm(x * f + seed, z * f + y * 0.7) - 0.5) * 2 * amp; p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d); }
  g.computeVertexNormals(); return g;
}
const merge = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));   // each part keeps its own smooth normals
const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// ---------------------------------------------------------------- the pieces (local units = map units at full icon size)
// ---- a craggy felt mountain: a dense cone pushed out into 3–5 sharp ridges, leaning a little, with one or two shoulder
// peaks; snow coloured per vertex, reaching further down the ridges than the hollows (streaks, as in the reference)
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rngOf(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function crag(cx, cz, h, r, { ridges, phase, lean, seed, snow, rock }) {
  const RAD = 40, RINGS = 22, pos = [], col = [], idx = [], c = new THREE.Color(), cs = new THREE.Color(0xf6f3ee), cr = new THREE.Color(rock), cb = new THREE.Color(0x6f6a5a);
  for (let j = 0; j <= RINGS; j++) {
    const t = j / RINGS, y = t * h, prof = Math.pow(1 - t, 0.92);   // broad shoulders, a pointed top
    for (let i = 0; i <= RAD; i++) {
      const th = (i / RAD) * Math.PI * 2, ridge = Math.pow(Math.abs(Math.cos((ridges * th) / 2 + phase)), 2.6);
      const n = fbm(Math.cos(th) * 1.7 + seed, Math.sin(th) * 1.7 + t * 2.3) - 0.5, n2 = fbm(th * 3 + seed * 2, t * 6) - 0.5;
      const rr = r * prof * (0.8 + 0.3 * ridge + 0.22 * n + 0.1 * n2);
      pos.push(cx + lean[0] * y + Math.cos(th) * rr, y, cz + lean[1] * y + Math.sin(th) * rr);
      // rock: lavender-grey wool, a little warmer and darker low down; snow: down the ridges, ragged
      c.copy(cr).multiplyScalar(0.86 + 0.28 * (n2 + 0.5)).lerp(cb, smooth01(0.22, 0.0, t) * 0.5);
      if (snow) { const line = 0.74 - 0.26 * ridge + 0.14 * n + 0.08 * n2; /* the top third, streaking down the ridges */ c.lerp(cs, smooth01(line - 0.03, line + 0.05, t)); }
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < RAD; i++) { const a = j * (RAD + 1) + i, b = a + RAD + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
function mountain(variant, snow = true, rock = 0x8a8098) {
  const R = rngOf(variant * 17 + 3), parts = [];
  parts.push(crag(0, 0, 1, 0.56 + R() * 0.12, { ridges: 3 + Math.floor(R() * 3), phase: R() * 6, lean: [(R() - 0.5) * 0.18, (R() - 0.5) * 0.18], seed: variant * 3.1, snow, rock }));
  const shoulders = 1 + Math.floor(R() * 2);
  for (let k = 0; k < shoulders; k++) {
    const a = R() * Math.PI * 2, d = 0.22 + R() * 0.16, h = 0.45 + R() * 0.3;
    parts.push(crag(Math.cos(a) * d, Math.sin(a) * d, h, 0.36 + R() * 0.1, { ridges: 3 + Math.floor(R() * 2), phase: R() * 6, lean: [Math.cos(a) * 0.12, Math.sin(a) * 0.12], seed: variant * 5.3 + k, snow, rock }));
  }
  return { body: mergeGeometries(parts.map((g) => g.toNonIndexed())) };
}
function fir(snow) {
  const t = (r, h, y) => new THREE.ConeGeometry(r, h, 9).scale(1, 0.85, 1).translate(0, y, 0);
  const parts = [paint(merge([t(0.34, 0.42, 0.36), t(0.27, 0.38, 0.6), t(0.19, 0.34, 0.82)]), 0x2f5e3c), paint(new THREE.CylinderGeometry(0.04, 0.05, 0.2, 6).translate(0, 0.1, 0), 0x6b4a32)];
  if (snow) parts.push(paint(lumpy(new THREE.SphereGeometry(0.1, 8, 5).scale(1, 0.55, 1).translate(0, 0.98, 0), 0.01, 9), 0xf7f4ee), paint(new THREE.TorusGeometry(0.21, 0.04, 5, 12).rotateX(Math.PI / 2).translate(0, 0.66, 0), 0xf7f4ee));
  return { body: merge(parts) };
}
function cottage(wall = 0xe8dcc4, roof = 0x9a3a2e) {
  const tri = new THREE.Shape([new THREE.Vector2(-0.6, 0), new THREE.Vector2(0, 0.5), new THREE.Vector2(0.6, 0)]);
  const body = merge([paint(new THREE.BoxGeometry(1, 0.7, 0.8).translate(0, 0.35, 0), wall), paint(new THREE.ExtrudeGeometry(tri, { depth: 0.96, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }).translate(0, 0.7, -0.48), roof),
    paint(new THREE.BoxGeometry(0.14, 0.32, 0.14).translate(0.28, 1.0, -0.1), 0x8a4a3a), paint(lumpy(new THREE.BoxGeometry(1.15, 0.12, 1.0, 4, 1, 4).translate(0, 1.12, 0).scale(0.9, 1, 1), 0.02, 5), 0xf7f4ee),
    paint(new THREE.BoxGeometry(0.2, 0.36, 0.04).translate(0, 0.18, 0.41), 0x5a3a26)]);
  const glow = merge([new THREE.BoxGeometry(0.18, 0.18, 0.03).translate(-0.3, 0.42, 0.41), new THREE.BoxGeometry(0.18, 0.18, 0.03).translate(0.3, 0.42, 0.41)]);
  return { body, glow };
}
function farm() {   // a red barn and a windmill
  const gam = new THREE.Shape([[-0.62, 0], [-0.52, 0.3], [0, 0.52], [0.52, 0.3], [0.62, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
  const barn = [paint(new THREE.BoxGeometry(1.1, 0.75, 0.9).translate(0, 0.375, 0), 0xb8382e), paint(new THREE.ExtrudeGeometry(gam, { depth: 1.0, bevelEnabled: false }).translate(0, 0.75, -0.5), 0x5a4a4a),
    paint(new THREE.BoxGeometry(0.42, 0.5, 0.04).translate(0, 0.25, 0.46), 0xf0e2c4)];
  const mill = [paint(new THREE.CylinderGeometry(0.06, 0.16, 1.6, 6).translate(1.1, 0.8, 0.1), 0x9a6a3a), paint(new THREE.BoxGeometry(0.16, 0.16, 0.2).translate(1.1, 1.62, 0.18), 0x7a4a2a)];
  for (let i = 0; i < 4; i++) mill.push(paint(new THREE.BoxGeometry(0.1, 0.62, 0.02).translate(0, 0.33, 0).rotateZ(i * Math.PI / 2 + 0.3).translate(1.1, 1.62, 0.3), 0xf0e2c4));
  return { body: merge([...barn, ...mill]), glow: new THREE.BoxGeometry(0.16, 0.14, 0.03).translate(0, 0.98, 0.46) };
}
function cactus() {
  const g = 0x4f8a4a, s = (r, h) => new THREE.CapsuleGeometry(r, h, 4, 8);
  return { body: merge([paint(s(0.09, 0.8).translate(0, 0.5, 0), g), paint(s(0.06, 0.26).translate(0, 0.13, 0).rotateZ(-1.2).translate(0.16, 0.42, 0), g), paint(s(0.06, 0.3).translate(0.26, 0.6, 0), g),
    paint(s(0.055, 0.2).translate(0, 0.1, 0).rotateZ(1.2).translate(-0.14, 0.55, 0), g), paint(s(0.05, 0.24).translate(-0.24, 0.7, 0), g), paint(new THREE.SphereGeometry(0.05, 6, 4).translate(0, 0.98, 0), 0xe0607a)]) };
}
// ---- red-rock country: sheer-sided formations with horizontal bands of rust, orange and cream, scree at the foot
function rockOutline(r, n, seed, rough = 0.28) { const R = rngOf(seed), pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([Math.cos(a) * r * (1 - rough / 2 + rough * R()), Math.sin(a) * r * (0.7 + 0.25 * R()) * (1 - rough / 2 + rough * R())]); } return pts; }
function bandColour(y, seed) {
  const bands = [0xb84a2c, 0xd0703e, 0xc85a34, 0xe0a070, 0xa8402a, 0xd8804a];
  const k = Math.floor(y / 0.065 + Math.sin(y * 9 + seed) * 0.4), c = new THREE.Color(bands[((k % bands.length) + bands.length) % bands.length]);
  return (k % 5 === 2) ? c.lerp(new THREE.Color(0xf0d0a8), 0.6) : c;
}
function tier(outline, y0, h, seed) {   // a sheer-sided slab of rock: vertical walls, a flat top, banded by height
  const sh = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 1, curveSegments: 1, steps: Math.max(2, Math.round(h / 0.05)) }).rotateX(-Math.PI / 2).translate(0, y0, 0);
  const ng = g.toNonIndexed(), p = ng.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = bandColour(p.getY(i), seed); col.set([c.r, c.g, c.b], i * 3); }
  ng.deleteAttribute('uv'); ng.setAttribute('color', new THREE.BufferAttribute(col, 3)); ng.computeVertexNormals(); return ng;
}
function scree(outline, k = 1.35, h = 0.1) {   // a skirt of fallen rock round the base
  const n = outline.length, pos = [], idx = [];
  outline.forEach(([x, z]) => pos.push(x * k, 0, z * k)); outline.forEach(([x, z]) => pos.push(x * 0.98, h, z * 0.98));
  for (let i = 0; i < n; i++) { const a = i, b = (i + 1) % n; idx.push(a, b, n + a, b, n + b, n + a); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return paint(lumpy(g, 0.02, 6), 0xd08a58);
}
function mesa(variant) {
  const R = rngOf(variant * 29 + 7), parts = [];
  if (variant === 0) {          // a wide mesa: one broad table, a thin cap rock
    const o = rockOutline(1, 16, variant + 1); parts.push(tier(o, 0, 0.36 + R() * 0.1, 1), tier(o.map(([x, z]) => [x * 0.92, z * 0.92]), 0.4, 0.05, 2), scree(o));
  } else if (variant === 1) {   // a stepped mesa
    const o = rockOutline(0.95, 14, variant + 2); parts.push(tier(o, 0, 0.26, 3), tier(o.map(([x, z]) => [x * 0.66 + 0.1, z * 0.66]), 0.26, 0.24, 4), tier(o.map(([x, z]) => [x * 0.38 + 0.15, z * 0.38]), 0.5, 0.2, 5), scree(o));
  } else if (variant === 2) {   // a tall butte (Monument Valley)
    const o = rockOutline(0.42, 12, variant + 3, 0.36); parts.push(tier(o, 0, 0.95 + R() * 0.25, 6), scree(o, 1.8, 0.16));
  } else {                       // a cluster of spires
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + R(), d = 0.22 + R() * 0.1, o = rockOutline(0.13 + R() * 0.06, 9, variant * 7 + k, 0.4).map(([x, z]) => [x + Math.cos(a) * d, z + Math.sin(a) * d]); parts.push(tier(o, 0, 0.7 + R() * 0.55, 7 + k)); }
    parts.push(scree(rockOutline(0.55, 12, 9), 1.1, 0.08));
  }
  return { body: mergeGeometries(parts) };
}
function lighthouse() {
  const parts = [paint(lumpy(new THREE.SphereGeometry(0.4, 8, 5).scale(1, 0.4, 1), 0.04, 3), 0x8a8590)];
  for (let i = 0; i < 4; i++) { const y0 = 0.1 + i * 0.26, r0 = 0.2 - i * 0.022; parts.push(paint(new THREE.CylinderGeometry(r0 - 0.022, r0, 0.26, 12).translate(0, y0 + 0.13, 0), i % 2 ? 0xf0e2c4 : 0xc8302a)); }
  parts.push(paint(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 12).translate(0, 1.16, 0), 0x2a2630), paint(new THREE.ConeGeometry(0.13, 0.16, 12).translate(0, 1.38, 0), 0xc8302a));
  return { body: merge(parts), glow: new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10).translate(0, 1.25, 0) };
}
function palm() {
  const trunk = []; for (let i = 0; i < 6; i++) trunk.push(paint(new THREE.CylinderGeometry(0.05, 0.065, 0.2, 7).translate(0.03 * i * i * 0.3, 0.1 + i * 0.18, 0), 0x9a7a52));
  const top = V(0.32, 1.1, 0), leaves = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, leaf = new THREE.SphereGeometry(0.28, 8, 4).scale(1, 0.12, 0.32).translate(0.26, -0.05, 0).rotateZ(-0.45).rotateY(a); leaves.push(paint(leaf.translate(top.x, top.y, top.z), i % 2 ? 0x3f7a42 : 0x4f8a4a)); }
  return { body: merge([...trunk, ...leaves]) };
}
function moose() {
  const b = 0x6a4a32, d = 0x4a3220;
  const parts = [paint(lumpy(new THREE.SphereGeometry(0.4, 10, 7).scale(1.25, 0.8, 0.7).translate(0, 0.78, 0), 0.02, 4), b), paint(lumpy(new THREE.SphereGeometry(0.17, 8, 6).scale(1.5, 0.9, 0.9).translate(0.62, 0.92, 0), 0.01, 6), d)];
  for (const [x, z] of [[-0.32, 0.16], [-0.32, -0.16], [0.3, 0.16], [0.3, -0.16]]) parts.push(paint(new THREE.CylinderGeometry(0.05, 0.04, 0.55, 6).translate(x, 0.28, z), d));
  for (const s of [-1, 1]) parts.push(paint(new THREE.SphereGeometry(0.2, 8, 3).scale(0.8, 0.18, 1.1).translate(0.5, 1.2, s * 0.22).rotateX(s * 0.25), 0xd9c4a0));
  return { body: merge(parts) };
}
function mission() {
  const adobe = 0xe8cfa0;
  const arch = new THREE.Shape(); arch.moveTo(-0.14, 0); arch.lineTo(0.14, 0); arch.lineTo(0.14, 0.25); arch.absarc(0, 0.25, 0.14, 0, Math.PI, false); arch.lineTo(-0.14, 0);
  return { body: merge([paint(new THREE.BoxGeometry(1.0, 0.6, 0.6).translate(0, 0.3, 0), adobe), paint(new THREE.BoxGeometry(0.34, 1.0, 0.34).translate(0.45, 0.5, 0.05), adobe), paint(new THREE.CylinderGeometry(0.0, 0.2, 0.2, 4).rotateY(Math.PI / 4).translate(0.45, 1.1, 0.05), 0xc8603a),
    paint(new THREE.ExtrudeGeometry(arch, { depth: 0.04, bevelEnabled: false }).translate(-0.15, 0, 0.3), 0x6a3a22), paint(new THREE.BoxGeometry(0.05, 0.2, 0.05).translate(-0.15, 0.78, 0.0), 0x6a3a22), paint(new THREE.BoxGeometry(0.14, 0.05, 0.05).translate(-0.15, 0.82, 0.0), 0x6a3a22)]),
    glow: new THREE.BoxGeometry(0.12, 0.14, 0.03).translate(0.45, 0.78, 0.23) };
}

// ---------------------------------------------------------------- where they go (lon, lat, size in map units, turn)
const P = (lo, la) => A48([lo, la]);
const PLACES = {
  cottage: [[-111.0, 46.4], [-100.6, 46.9], [-89.6, 44.8], [-77.6, 41.0], [-80.2, 35.6], [-123.0, 44.2], [-92.4, 37.4], [-86.6, 35.6], [-71.9, 43.9], [-117.4, 47.6], [-106.0, 44.6], [-84.6, 33.0]],
  farm: [[-95.6, 42.2], [-99.0, 41.2], [-88.6, 40.4]],
  cactus: [[-112.0, 33.0], [-111.0, 32.3], [-113.6, 33.8], [-110.4, 31.9], [-115.6, 33.2], [-103.6, 30.6]],
  mesa: [[-110.2, 37.0], [-111.7, 36.4], [-109.4, 38.7], [-108.4, 36.5], [-107.0, 34.6]],
  lighthouse: [[-68.6, 44.25], [-124.15, 44.0], [-75.6, 35.25], [-69.95, 41.7], [-124.25, 40.7], [-86.4, 45.9]],
  palm: [[-80.6, 26.4], [-81.7, 28.1], [-117.1, 33.3], [-80.3, 25.6]],
  moose: [[-92.8, 47.6], [-69.4, 45.6]],
  mission: [[-106.1, 35.6]],
};
const SIZE = { cottage: 22, farm: 26, cactus: 30, mesa: 30, lighthouse: 22, palm: 22, moose: 24, mission: 24 };

export function buildLandmarks(group, geo, surfaceY, { tier = 'high' } = {}) {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mats = new Map();
  const bodyMat = felt(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true }), 'felt', { key: 'icon', extra: shrink });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb050, emissiveIntensity: 1.8, roughness: 0.9 });
  glowMat.onBeforeCompile = shrink; glowMat.customProgramCacheKey = () => 'icon-glow';
  function shrink(sh) {   // the icon's own size follows the camera (scaled about its foot)
    sh.uniforms.uIcon = iconScale;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uIcon;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= uIcon;');
  }
  const meshes = [];
  const place = (piece, list, { cast = true, tint = null } = {}) => {
    if (!list.length) return;
    const ib = new THREE.InstancedMesh(piece.body, bodyMat, list.length), ig = piece.glow ? new THREE.InstancedMesh(piece.glow, glowMat, list.length) : null;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach(([ax, ay, s, r, sx = 1, sy = 1], i) => {
      const x = ax - MAP_W / 2, z = ay - MAP_H / 2;
      m4.compose(V(x, surfaceY(ax, ay) - 0.1, z), q.setFromAxisAngle(V(0, 1, 0), r), V(s * sx, s * sy, s * sx));
      ib.setMatrixAt(i, m4); if (ig) ig.setMatrixAt(i, m4);
      ib.setColorAt(i, tint ? c.setHSL(...tint(i)) : c.setRGB(1, 1, 1));
    });
    ib.castShadow = cast; ib.receiveShadow = true; group.add(ib); meshes.push(ib); if (ig) { group.add(ig); meshes.push(ig); }
  };
  const nearSite = (ax, ay, k = 3.2) => Object.values(geo.sites).some((s) => Math.hypot(ax - s.a[0], ay - s.a[1]) < s.flatR * k);

  // ---- mountains: massifs of mixed peaks (six shapes) along each big range, overlapping, of different heights
  const VARIANTS = 6, peaks = Array.from({ length: VARIANTS }, () => []);
  for (const r of geo.ranges) {
    if (r.P.length < 2 || r.h < 7) continue;   // low ridges (coast, Appalachians): the patchwork and fir clusters carry those
    const line = new THREE.CatmullRomCurve3(r.P.map(([x, y]) => V(x, 0, y))), L = line.getLength(), step = r.h >= 14 ? 23 : 26;
    for (let s = step * 0.4; s < L; s += step * (0.8 + rnd() * 0.4)) {
      const t = line.getPointAt(Math.min(1, s / L)), n = 1 + Math.floor(rnd() * 2) + (r.h >= 14 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const ax = t.x + (rnd() - 0.5) * r.w * 1.1, ay = t.z + (rnd() - 0.5) * r.w * 1.1;
        if (!geo.inside(ax, ay) || nearSite(ax, ay)) continue;
        const hgt = (18 + r.h * 1.3) * (k === 0 ? 1 : 0.5 + rnd() * 0.45) * (0.8 + rnd() * 0.4) * (r.name.startsWith('Brooks') ? 0.5 : 1);
        peaks[Math.floor(rnd() * VARIANTS)].push([ax, ay, hgt, rnd() * 6.3, 0.85 + rnd() * 0.5, 1]);
      }
    }
  }
  peaks.forEach((list, v) => place(mountain(v, true, [0x6f6584, 0x675f7c, 0x786c8a, 0x6a6476, 0x736a86, 0x625c72][v]), list,
    { tint: (i) => [0.7 + (i % 3) * 0.03, 0.08, 0.94 + (i % 4) * 0.03] }));
  // ---- clusters of big felt firs in the forested regions (snow on the northern ones)
  const firN = [], firS = [];
  const nClusters = tier === 'low' ? 20 : 34;
  for (let i = 0, made = 0; i < 4000 && made < nClusters; i++) {
    const ax = rnd() * MAP_W, ay = rnd() * MAP_H, h = geo.height(ax, ay);
    if (h < 0.3 || rnd() > geo.forest(ax, ay, h) * 1.2 || nearSite(ax, ay, 3.6)) continue;
    made++;
    const n = 3 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.3, d = 3 + rnd() * 9, x = ax + Math.cos(a) * d, y = ay + Math.sin(a) * d; if (!geo.inside(x, y)) continue; (y < 220 ? firN : firS).push([x, y, 14 + rnd() * 9, rnd() * 6.3]); }
  }
  place(fir(true), firN, { tint: (i) => [0.36 + (i % 4) * 0.012, 0.3, 0.9 + (i % 3) * 0.06] });
  place(fir(false), firS, { tint: (i) => [0.34 + (i % 4) * 0.015, 0.35, 0.9 + (i % 3) * 0.07] });

  // ---- the rest, each kind one draw
  const at = (kind) => (PLACES[kind] || []).map(([lo, la]) => P(lo, la)).filter(Boolean).filter(([ax, ay]) => !nearSite(ax, ay)).map(([ax, ay]) => [ax, ay, SIZE[kind] * (0.85 + rnd() * 0.3), (rnd() - 0.5) * 0.9]);
  const cot = at('cottage');
  place(cottage(0xe8dcc4, 0x9a3a2e), cot.filter((_, i) => i % 3 === 0)); place(cottage(0xd99a6a, 0x3d5f8a), cot.filter((_, i) => i % 3 === 1)); place(cottage(0x9fb58a, 0x6b3326), cot.filter((_, i) => i % 3 === 2));
  place(farm(), at('farm')); place(cactus(), at('cactus')); place(lighthouse(), at('lighthouse'));
  place(palm(), at('palm')); place(moose(), at('moose')); place(mission(), at('mission'));
  // red-rock country: at each place a cluster of 4–6 mixed formations (mesas, stepped mesas, buttes, spires)
  const rocks = [[], [], [], []];
  for (const [ax0, ay0] of (PLACES.mesa || []).map(([lo, la]) => P(lo, la)).filter(Boolean)) {
    const n = 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.3, d = k ? 5 + rnd() * 14 : 0, ax = ax0 + Math.cos(a) * d, ay = ay0 + Math.sin(a) * d; if (!geo.inside(ax, ay) || nearSite(ax, ay)) continue;
      const v = k === 0 ? Math.floor(rnd() * 2) : Math.floor(rnd() * 4), sz = (v < 2 ? 15 : 11) * (0.7 + rnd() * 0.6);
      rocks[v].push([ax, ay, sz, rnd() * 6.3, 1, v === 2 ? 1.3 : 1]); }
  }
  rocks.forEach((list, v) => place(mesa(v), list, { tint: (i) => [0.04, 0.05 + (i % 3) * 0.05, 0.92 + (i % 4) * 0.03] }));
  void mats;
  return { meshes, count: meshes.reduce((s, m) => s + m.count, 0),
    setScale(k) { iconScale.value = Math.max(0.001, k); for (const m of meshes) m.visible = k > 0.03; } };
}
