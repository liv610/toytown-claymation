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
function mountain(snow = true, col = 0x8d8299) {
  const H = 1, R = 0.62;   // unit peak, scaled per instance
  const body = lumpy(lathe([[0.0, 0], [R, 0], [R * 0.86, 0.18], [R * 0.62, 0.42], [R * 0.36, 0.7], [R * 0.13, 0.92], [0, H]], 16), 0.035, 3.0, 1);
  const parts = [paint(body, col)];
  if (snow) {   // a batting cap with a ragged lower edge
    const cap = lathe([[R * 0.66 * 1.07, 0.32], [R * 0.5 * 1.08, 0.5], [R * 0.36 * 1.09, 0.7], [R * 0.13 * 1.12, 0.92], [0, H * 1.03]], 16);
    const p = cap.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); if (y < 0.36) p.setY(i, y - 0.1 * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 7))); }
    parts.push(paint(lumpy(cap, 0.03, 4.0, 5), 0xf7f4ee));
  }
  return { body: merge(parts) };
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
function mesa() {
  const layer = (rx, rz, h, y, col, seed) => { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, w = 0.82 + 0.3 * fbm(i * 0.7 + seed, seed); pts.push(new THREE.Vector2(Math.cos(a) * rx * w, Math.sin(a) * rz * w)); }
    return paint(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 1 }).rotateX(-Math.PI / 2).translate(0, y, 0), col); };
  return { body: merge([layer(0.95, 0.6, 0.18, 0, 0xc8603a, 1), layer(0.7, 0.42, 0.3, 0.18, 0xb8502e, 2), layer(0.5, 0.3, 0.2, 0.48, 0xd8784a, 3), layer(0.35, 0.22, 0.42, 0.18, 0xa8482a, 4).translate(0.7, 0, 0.2)]) };
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

  // ---- mountains: peaks along each range, two staggered rows for the big ones
  const peaksSnow = [], peaksGreen = [];
  for (const r of geo.ranges) {
    if (r.P.length < 2) continue;
    if (r.h < 7) continue;                                   // low ridges (coast, Appalachians): the patchwork and fir clusters carry those
    const big = r.h >= 9, line = new THREE.CatmullRomCurve3(r.P.map(([x, y]) => V(x, 0, y))), L = line.getLength();
    const step = big ? (r.h >= 14 ? 21 : 24) : 22, rows = r.h >= 14 ? [-0.42, 0.42] : [0];   // separate peaks, not a chain
    for (let s = step * 0.5; s < L; s += step) for (const off of rows) {
      const t = line.getPointAt(s / L), tg = line.getTangentAt(s / L), n = V(-tg.z, 0, tg.x);
      const ax = t.x + n.x * off * r.w + (rnd() - 0.5) * 3, ay = t.z + n.z * off * r.w + (rnd() - 0.5) * 3 + (off ? off * step * 0.5 : 0);
      if (!geo.inside(ax, ay) || nearSite(ax, ay)) continue;
      const hgt = (big ? 24 + r.h * 1.1 : 12 + r.h) * (0.7 + rnd() * 0.5) * (r.name.startsWith('Brooks') ? 0.55 : 1);
      (big ? peaksSnow : peaksGreen).push([ax, ay, hgt, rnd() * 6.3, 0.58 + rnd() * 0.14, 1]);   // narrow, tall: picture-map peaks
    }
  }
  place(mountain(true), peaksSnow, { tint: (i) => [0.72 + (i % 5) * 0.015, 0.1 + (i % 3) * 0.04, 0.82 + (i % 4) * 0.04] });
  place(mountain(false, 0x6f8a62), peaksGreen, { tint: (i) => [0.28 + (i % 4) * 0.02, 0.25, 0.86 + (i % 3) * 0.05] });

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
  place(farm(), at('farm')); place(cactus(), at('cactus')); place(mesa(), at('mesa')); place(lighthouse(), at('lighthouse'));
  place(palm(), at('palm')); place(moose(), at('moose')); place(mission(), at('mission'));
  void mats;
  return { meshes, count: meshes.reduce((s, m) => s + m.count, 0),
    setScale(k) { iconScale.value = Math.max(0.001, k); for (const m of meshes) m.visible = k > 0.03; } };
}
