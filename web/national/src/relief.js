// The clay national relief: a hand-sculpted slab of the country in a blue clay sea on a wooden base.
// Lightweight by design: one heightfield (clipped to the coastline in the shader), instanced trees and town
// clusters, three symbolic rail lines with little trains. Street-level detail lives only in the story dioramas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clay as patch } from './clay.js';
import { MAP_W, MAP_H, toWorld } from './geo.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SLAB = 7;              // thickness of the clay country (map units)
const SEA_Y = -3.2;

export function buildRelief(scene, geo, { tier = 'high' } = {}) {
  const group = new THREE.Group(); scene.add(group);
  const res = tier === 'high' ? [720, 450] : tier === 'medium' ? [480, 300] : [320, 200];

  // ---------------- the slab: the country's outline extruded, cut edges showing like a sculpted cake
  const shapes = [];
  const ng = geo.nation.features ? geo.nation.features[0].geometry : geo.nation.geometry;
  for (const poly of (ng.type === 'Polygon' ? [ng.coordinates] : ng.coordinates)) {
    const ring = (r) => r.map(([x, y]) => new THREE.Vector2(x - MAP_W / 2, MAP_H / 2 - y));
    const s = new THREE.Shape(ring(poly[0]));
    for (const hole of poly.slice(1)) s.holes.push(new THREE.Path(ring(hole)));
    shapes.push(s);
  }
  const slabMat = new THREE.MeshStandardMaterial({ color: 0x8e6b4c, roughness: 0.92 }); patch(slabMat, 'terrain');
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shapes, { depth: SLAB, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2, curveSegments: 2 }), slabMat);
  slab.rotation.x = -Math.PI / 2; slab.position.y = -SLAB + 0.05; slab.receiveShadow = slab.castShadow = true; group.add(slab);

  // ---------------- the sculpted surface: heightfield + clay colours, clipped to the coast per pixel
  const [nx, ny] = res;
  const surf = new THREE.PlaneGeometry(MAP_W, MAP_H, nx, ny); surf.rotateX(-Math.PI / 2);
  const pos = surf.attributes.position, cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ax = pos.getX(i) + MAP_W / 2, ay = pos.getZ(i) + MAP_H / 2;
    const h = geo.height(ax, ay);
    pos.setY(i, h < 0 ? -6 : h + 0.25);
    const c = geo.colour(ax, ay, h); cols.set(c, i * 3);
  }
  surf.setAttribute('color', new THREE.BufferAttribute(cols, 3)); surf.computeVertexNormals();
  const maskTex = new THREE.CanvasTexture(geo.maskCanvas); maskTex.colorSpace = THREE.NoColorSpace; maskTex.anisotropy = 8;
  const landMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  patch(landMat, 'terrain');
  const inner = landMat.onBeforeCompile;
  landMat.onBeforeCompile = (sh) => {
    inner(sh); sh.uniforms.uMask = { value: maskTex };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec4 m = texture2D(uMask, vec2((vCP.x + ${(MAP_W / 2).toFixed(1)}) / ${MAP_W.toFixed(1)}, 1.0 - (vCP.z + ${(MAP_H / 2).toFixed(1)}) / ${MAP_H.toFixed(1)}));
          if (m.r < 0.5) discard;
          diffuseColor.rgb *= 1.0 - 0.32 * m.g; }                       // state lines pressed into the clay`);
  };
  landMat.customProgramCacheKey = () => 'nat-land';
  const land = new THREE.Mesh(surf, landMat); land.receiveShadow = land.castShadow = true; group.add(land);

  // ---------------- blue clay sea + wooden display base
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x3f86b8, roughness: 0.32 }); patch(seaMat, 'water');
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W * 1.32, MAP_H * 1.42), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; sea.receiveShadow = true; group.add(sea);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.75 }); patch(wood, 'wood');
  const base = new THREE.Mesh(new THREE.BoxGeometry(MAP_W * 1.36, 10, MAP_H * 1.46), wood); base.position.y = SEA_Y - 5.05; base.receiveShadow = true; group.add(base);
  const lip = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.7 });
  for (const [w, d, x, z] of [[MAP_W * 1.38, 6, 0, MAP_H * 0.73], [MAP_W * 1.38, 6, 0, -MAP_H * 0.73], [6, MAP_H * 1.48, MAP_W * 0.69, 0], [6, MAP_H * 1.48, -MAP_W * 0.69, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 4.5, d), lip); b.position.set(x, SEA_Y + 1.2, z); b.castShadow = b.receiveShadow = true; group.add(b);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = SEA_Y - 10.2; group.add(floor);

  const surfaceY = (ax, ay) => Math.max(0.25, geo.height(ax, ay) + 0.25);

  // ---------------- forests: thousands of tiny clay firs (one draw each for bodies and snow caps)
  const firBody = mergeGeometries([new THREE.ConeGeometry(0.62, 1.3, 7).translate(0, 1.0, 0), new THREE.ConeGeometry(0.48, 1.0, 7).translate(0, 1.6, 0), new THREE.CylinderGeometry(0.1, 0.12, 0.5, 5).translate(0, 0.25, 0)]);
  const firSnow = mergeGeometries([new THREE.ConeGeometry(0.3, 0.45, 7).translate(0, 2.0, 0), new THREE.ConeGeometry(0.42, 0.25, 7).translate(0, 1.42, 0)]);
  const firs = [];
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const target = tier === 'low' ? 2200 : tier === 'medium' ? 4200 : 7000;
  for (let i = 0; i < target * 12 && firs.length < target; i++) {
    const ax = rnd() * MAP_W, ay = rnd() * MAP_H, h = geo.height(ax, ay);
    if (h < 0.3 || rnd() > geo.forest(ax, ay, h)) continue;
    let nearSite = false; for (const s of Object.values(geo.sites)) if (Math.hypot(ax - s.a[0], ay - s.a[1]) < s.flatR * 1.3) nearSite = true;
    if (!nearSite) firs.push([ax, ay, h, 0.55 + rnd() * 0.75, rnd()]);
  }
  const fb = new THREE.MeshStandardMaterial({ color: 0x3d6b4a, roughness: 0.85 }); patch(fb, 'clay');
  const fs = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85 }); patch(fs, 'snow');
  const imB = new THREE.InstancedMesh(firBody, fb, firs.length), imS = new THREE.InstancedMesh(firSnow, fs, firs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), col = new THREE.Color();
  firs.forEach(([ax, ay, h, s, r], i) => {
    const [x, z] = toWorld(ax, ay);
    m4.compose(V(x, h + 0.2, z), q.setFromAxisAngle(V(0, 1, 0), r * 6.3), sc.set(s, s * (0.9 + r * 0.3), s));
    imB.setMatrixAt(i, m4); imS.setMatrixAt(i, m4);
    imB.setColorAt(i, col.setHSL(0.36 + r * 0.06, 0.32, 0.26 + r * 0.08));
  });
  for (const im of [imB, imS]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }

  // ---------------- town clusters (generic regional places, not campaign locations)
  const houseGeo = (() => {
    const wall = new THREE.BoxGeometry(1, 0.8, 0.9).translate(0, 0.4, 0);
    const tri = new THREE.Shape([new THREE.Vector2(-0.6, 0), new THREE.Vector2(0, 0.55), new THREE.Vector2(0.6, 0)]);
    const roof = new THREE.ExtrudeGeometry(tri, { depth: 1.05, bevelEnabled: false }).translate(0, 0.8, -0.525);
    roof.deleteAttribute('uv'); wall.deleteAttribute('uv');
    return mergeGeometries([wall.toNonIndexed(), roof.toNonIndexed()]);
  })();
  const houses = [];
  const palette = [0xc8513f, 0x3d6fa8, 0xd98aa0, 0xe2c25a, 0x8fb59a, 0xd8c29e, 0xb59ad0, 0xe59a5a];
  for (const [ax, ay] of geo.towns) {
    const n = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.3, d = rnd() * 2.6; houses.push([ax + Math.cos(a) * d, ay + Math.sin(a) * d, 0.6 + rnd() * 0.5, rnd() * 6.3, palette[Math.floor(rnd() * palette.length)]]); }
  }
  const hm = new THREE.MeshStandardMaterial({ roughness: 0.8 }); patch(hm, 'clay');
  const imH = new THREE.InstancedMesh(houseGeo, hm, houses.length);
  houses.forEach(([ax, ay, s, r, c], i) => { const [x, z] = toWorld(ax, ay); m4.compose(V(x, surfaceY(ax, ay) - 0.05, z), q.setFromAxisAngle(V(0, 1, 0), r), sc.set(s, s, s)); imH.setMatrixAt(i, m4); imH.setColorAt(i, col.set(c)); });
  imH.castShadow = imH.receiveShadow = true; group.add(imH);

  // ---------------- three symbolic rail lines (ribbons of coloured clay) that meet at Toy Town
  const COLS = { red: 0xb8322a, blue: 0x2f5f9e, green: 0x3a7a52 };
  const lines = {};
  for (const [name, pts] of Object.entries(geo.lines)) {
    const ctrl = new THREE.CatmullRomCurve3(pts.map(([ax, ay]) => { const [x, z] = toWorld(ax, ay); return V(x, 0, z); }), false, 'centripetal');
    const L = ctrl.getLength(), N = Math.ceil(L / 2);
    const dense = []; for (let i = 0; i <= N; i++) { const p = ctrl.getPointAt(i / N); const ax = p.x + MAP_W / 2, ay = p.z + MAP_H / 2; p.y = Math.max(surfaceY(ax, ay), 0.3) + 0.35; dense.push(p); }
    // smooth the climb over mountains so the line reads as a railway, not a scribble
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < dense.length - 1; i++) dense[i].y = Math.max(dense[i].y, (dense[i - 1].y + dense[i + 1].y) / 2 - 0.2);
    const curve = new THREE.CatmullRomCurve3(dense, false, 'centripetal');
    const tube = new THREE.TubeGeometry(curve, N * 2, 0.42, 6, false); tube.scale(1, 1, 1);
    const m = new THREE.MeshStandardMaterial({ color: COLS[name], roughness: 0.7, transparent: true }); patch(m, 'clay');
    const mesh = new THREE.Mesh(tube, m); mesh.castShadow = mesh.receiveShadow = true; mesh.scale.set(1, 1, 1); group.add(mesh);
    lines[name] = { curve, L: curve.getLength(), color: COLS[name], mesh };
  }
  // little trains (engine + two cars) shuttle along each line
  const trains = Object.entries(lines).map(([name, ln], idx) => {
    const g = new THREE.Group(); group.add(g);
    const parts = [0, 1, 2].map((k) => {
      const p = new THREE.Group(); g.add(p);
      const bodyM = new THREE.MeshStandardMaterial({ color: k === 0 ? 0x2a2624 : ln.color, roughness: 0.6 }); patch(bodyM, 'clay');
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.0), bodyM); b.position.y = 0.75; b.castShadow = true; p.add(b);
      if (k === 0) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 8), bodyM); c.position.set(0.7, 1.45, 0); p.add(c); }
      return p;
    });
    return { g, parts, ln, phase: idx * 0.33, speed: 9 + idx * 1.5 };
  });
  function update(dt, t) {
    for (const tr of trains) {
      const period = (tr.ln.L / tr.speed) * 2, u = ((t / period + tr.phase) % 1) * 2, fwd = u < 1, s = (fwd ? u : 2 - u) * tr.ln.L;
      tr.parts.forEach((p, i) => {
        const si = Math.min(tr.ln.L - 0.01, Math.max(0.01, s + (fwd ? -i : i) * 2.6)), k = si / tr.ln.L;
        p.position.copy(tr.ln.curve.getPointAt(k));
        const tg = tr.ln.curve.getTangentAt(k); p.rotation.set(0, Math.atan2(-tg.z, tg.x) + (fwd ? 0 : Math.PI), 0);
      });
    }
  }
  // the symbolic lines belong to the map view: they fade away as the camera comes down into a community
  function setLineFade(k) {
    for (const ln of Object.values(lines)) { ln.mesh.material.opacity = k; ln.mesh.visible = k > 0.02; ln.mesh.castShadow = k > 0.9; }
    for (const tr of trains) tr.g.visible = k > 0.02;
  }
  return { group, land, surfaceY, lines, trains, update, setLineFade, houses: imH, firs: imB };
}
