// The felt national map (the felt look): a quilted, hand-sewn United States on a navy felt sea — after the owner's
// reference image. Same interface as relief.js (buildRelief), so the descent, Chapter 1, the pins and the action bar
// work unchanged.
//   * every state is its own felt patch in a soft regional colour, puffed in the middle and dipping at its seams;
//   * dashed running stitch along the state borders, a gold blanket stitch round the coast;
//   * mountains are soft wool roving with batting snow on the peaks; snowy ground round the story towns;
//   * felt firs, little felt houses with lit windows, rail routes as padded cords with a running stitch on top;
//   * batting clouds drifting over the map (they thin out as the camera comes down).
// Session 1 of the owner's picture-map reference (warm patchwork, chunky gold stitching on every state and the coast,
// routes as bold dashed stitching meeting at Toy Town, blue felt lakes with wave stitching, stitched rivers, woolly
// mottled felt, big batting clouds at the edges). Landmarks and Canada / Mexico come in later sessions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { feature } from 'topojson-client';
import { geoPath, geoAlbers } from 'd3-geo';
// the lower-48 part of Albers USA (identical there), defined beyond the border too (lake shores, later Canada)
const A48 = geoAlbers().scale(1300).translate([487.5, 305]);
import { felt } from './felt.js';
import { MAP_W, MAP_H, toWorld, fbm } from './geo.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// the Great Lakes' northern shores (lon, lat), closed through US land (which covers it): the lakes are drawn as brighter
// blue felt. Approximate; replaced by real shorelines once Canada is part of the map.
const LAKES = [[-92.3, 46.6], [-90.4, 47.8], [-89.3, 48.1], [-88.2, 48.9], [-86.4, 48.8], [-85.0, 47.9], [-84.6, 46.6], [-83.6, 46.25], [-81.6, 46.1],
  [-80.4, 45.4], [-80.1, 44.6], [-81.3, 44.3], [-81.7, 43.4], [-82.4, 43.0], [-82.5, 42.3], [-81.3, 42.65], [-80.0, 42.75], [-79.1, 42.95],
  [-79.7, 43.3], [-78.6, 43.95], [-77.2, 44.05], [-76.3, 44.25], [-75.9, 43.9], [-76.3, 43.2], [-79.5, 42.2], [-83.5, 41.4], [-87.5, 41.4], [-88.2, 42.4], [-89.0, 45.4], [-92.6, 46.2]];
// stylised river courses (lon, lat): Mississippi, Missouri, Ohio, Colorado, Columbia, Rio Grande, Arkansas, Snake
const RIVERS = [
  [[-95.2, 47.2], [-93.3, 44.9], [-91.2, 43.0], [-90.6, 41.5], [-91.3, 40.2], [-90.2, 38.6], [-89.2, 37.0], [-90.0, 35.1], [-91.1, 33.0], [-91.4, 31.0], [-90.1, 30.0], [-89.4, 29.2]],
  [[-111.5, 47.5], [-108.0, 47.7], [-104.0, 48.0], [-101.0, 47.4], [-100.4, 44.4], [-97.5, 42.8], [-96.0, 41.3], [-94.6, 39.1], [-92.2, 38.6], [-90.3, 38.8]],
  [[-80.0, 40.4], [-81.6, 39.3], [-82.6, 38.6], [-84.5, 39.1], [-85.8, 38.3], [-87.6, 37.9], [-89.1, 37.0]],
  [[-105.9, 40.2], [-107.6, 39.5], [-109.6, 38.6], [-111.2, 37.0], [-112.5, 36.1], [-114.0, 36.0], [-114.6, 34.5], [-114.7, 32.7]],
  [[-117.5, 48.9], [-118.0, 47.6], [-119.2, 46.2], [-121.0, 45.7], [-122.7, 45.7], [-123.9, 46.2]],
  [[-106.6, 37.5], [-106.7, 35.0], [-106.5, 31.8], [-104.5, 29.6], [-101.4, 29.8], [-99.5, 27.5], [-97.2, 25.9]],
  [[-106.2, 38.9], [-104.6, 38.2], [-101.0, 37.9], [-97.3, 37.7], [-95.4, 35.8], [-92.3, 34.7], [-91.1, 33.9]],
  [[-110.8, 44.0], [-112.5, 43.0], [-114.8, 42.6], [-116.9, 43.8], [-117.0, 46.4], [-119.0, 46.2]],
];
export const threadScale = { value: 1 };
const SLAB = 6, SEA_Y = -2.6, PUFF = 0.9;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// the regional felt colours (the clay map's regions, as felt you could buy: softer, a little dusty)
function regionColour(ax, ay) {
  const hex = (n) => new THREE.Color(n), c = hex(0x86a865);
  const mix = (b, k) => c.lerp(hex(b), Math.max(0, Math.min(1, k)));
  mix(0x6f9a58, sstep(330, 430, ay));                                         // greener south
  mix(0xd8b466, sstep(560, 470, ax) * sstep(250, 330, ax));                    // golden plains
  mix(0xd99062, sstep(400, 330, ax) * sstep(250, 330, ay));                    // terracotta desert
  mix(0xc66a4a, sstep(80, 30, Math.hypot(ax - 268, ay - 300)));                // red rock country
  mix(0x5d8a5a, sstep(160, 120, ax) * sstep(220, 120, ay));                    // Pacific Northwest
  mix(0x9a8fb0, sstep(330, 230, ax) * sstep(140, 250, ay) * 0.55);             // mountain states: lavender-grey
  mix(0xc9867e, sstep(780, 860, ax) * sstep(170, 120, ay) * 0.5);              // New England: rose
  mix(0xe0c27a, sstep(560, 640, ax) * sstep(180, 120, ay) * sstep(760, 700, ax) * 0.5);   // upper Midwest: wheat
  return c;
}

// families of felt colours by region (after the owner's reference picture map)
function patchFamily(ax, ay) {
  const west = ax < 300, mtn = ax >= 230 && ax < 420, plains = ax >= 400 && ax < 600, south = ay > 360, north = ay < 200, east = ax >= 760;
  if (west && ay < 180) return [0x6f8a4a, 0x9a5a3c, 0xc98a5a, 0x7d9a5a];                 // Pacific Northwest: olive, rust, peach
  if (west) return [0xb8553a, 0xd8956a, 0x8a9a5a, 0xc87a55];                             // California / Nevada: rust, peach, sage
  if (mtn && south) return [0xd9a05a, 0xc8673f, 0xe0b878, 0xb85a3a];                     // Southwest: mustard, terracotta
  if (mtn) return [0x9a8a9a, 0xd8956a, 0x8a9a5a, 0xc8a066];                              // mountain states: heather, peach, sage
  if (plains && south) return [0xd9873f, 0xc9a24e, 0xb8573a, 0xe0b878, 0x8a9a52];        // Texas / Oklahoma: orange, mustard, rust, olive
  if (plains) return [0xe0b25a, 0xd98a7a, 0x9aa858, 0xc87a4a, 0xe8c27a];                 // plains: mustard, rose-peach, olive, rust, wheat
  if (east && north) return [0x9a6a5a, 0x7d9a5a, 0xc8826e, 0x8aa06a];                    // New England: rose-brown, sage
  if (south) return [0x6f9a4a, 0x9aa858, 0x5f8a4a, 0xc8a066, 0xd8956a];                  // the South: greens, olive, peach
  return [0x8aa058, 0xd8a070, 0x5f8a4a, 0xc9a24e, 0xc87060, 0xa8b468];                   // Midwest / mid-Atlantic: olive, peach, green, mustard, rose
}

export function buildFeltRelief(scene, geo, { tier = 'high' } = {}) {
  const group = new THREE.Group(); scene.add(group);
  const res = tier === 'high' ? [720, 450] : tier === 'medium' ? [480, 300] : [320, 200];
  const states = feature(geo.topo, geo.topo.objects.states);

  // ---------------- 2D layers: each state's felt colour, and a soft "distance to a seam" for the quilting puff
  const K = 2, W = MAP_W * K, H = MAP_H * K;
  const colC = document.createElement('canvas'); colC.width = W; colC.height = H;
  const cg = colC.getContext('2d'); cg.scale(K, K); const cpath = geoPath(null, cg);
  cg.fillStyle = '#000'; cg.fillRect(0, 0, MAP_W, MAP_H);
  states.features.forEach((f, i) => {
    const [cx, cy] = cpath.centroid(f), id = +f.id || i, j = hash(id), j2 = hash(id * 3.7);
    // patchwork: each state a piece of felt from its region's family of warm colours (rust, peach, olive, mustard,
    // sage, terracotta, rose), so neighbours differ but each region keeps its character
    const fam = patchFamily(cx, cy), pick = fam[Math.floor(j * fam.length) % fam.length];
    const col = new THREE.Color(pick).lerp(regionColour(cx, cy), 0.06), hsl = {}; col.getHSL(hsl);
    col.setHSL(hsl.h, Math.min(1, hsl.s * (0.92 + 0.18 * j2)), Math.min(0.74, Math.max(0.3, hsl.l + (j2 - 0.5) * 0.07)));
    cg.fillStyle = '#' + col.getHexString(); cg.beginPath(); cpath(f); cg.fill();
  });
  const colTex = new THREE.CanvasTexture(colC); colTex.colorSpace = THREE.SRGBColorSpace; colTex.anisotropy = 8;
  // seams: state borders and the coast drawn as lines, blurred (1 on a seam → 0 well inside a state)
  const seamC = document.createElement('canvas'); seamC.width = MAP_W; seamC.height = MAP_H;
  const sg = seamC.getContext('2d'), spath = geoPath(null, sg);
  sg.fillStyle = '#000'; sg.fillRect(0, 0, MAP_W, MAP_H); sg.filter = 'blur(2.5px)'; sg.strokeStyle = '#fff'; sg.lineWidth = 2.2; sg.lineJoin = 'round';
  sg.beginPath(); spath(geo.borders); spath(geo.nation); sg.stroke();
  const seamPx = sg.getImageData(0, 0, MAP_W, MAP_H).data;
  const seam = (ax, ay) => { const x = Math.round(ax), y = Math.round(ay); if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 1; return seamPx[(y * MAP_W + x) * 4] / 255; };
  // the quilting puff, but none on the levelled ground of the story towns (the dioramas sit exactly on the map)
  const siteFlat = (ax, ay) => { let k = 0; for (const st of Object.values(geo.sites)) k = Math.max(k, sstep(st.flatR * 2.2, st.flatR * 1.4, Math.hypot(ax - st.a[0], ay - st.a[1]))); return k; };
  const surf = (ax, ay) => { const h = geo.height(ax, ay); return h < 0 ? -6 : h + 0.25 + PUFF * (1 - Math.min(1, seam(ax, ay) * 1.6)) * (1 - siteFlat(ax, ay)); };
  const snowAt = (ax, ay, h) => { let s = sstep(7, 12, h); for (const st of Object.values(geo.sites)) s = Math.max(s, sstep(st.flatR * 1.6, st.flatR * 0.8, Math.hypot(ax - st.a[0], ay - st.a[1]))); return s; };

  // ---------------- the felt slab under the country (cut edge showing), and the surface
  const shapes = [];
  const ng = geo.nation.features ? geo.nation.features[0].geometry : geo.nation.geometry;
  const polys = ng.type === 'Polygon' ? [ng.coordinates] : ng.coordinates;
  for (const poly of polys) {
    const ring = (r) => r.map(([x, y]) => new THREE.Vector2(x - MAP_W / 2, MAP_H / 2 - y));
    const s = new THREE.Shape(ring(poly[0])); for (const hole of poly.slice(1)) s.holes.push(new THREE.Path(ring(hole))); shapes.push(s);
  }
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shapes, { depth: SLAB, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3, curveSegments: 2 }),
    felt(new THREE.MeshStandardMaterial({ color: 0xe9dcc2 }), 'felt', { key: 'slab' }));   // a cream felt backing, like the cut edge of a quilt
  slab.rotation.x = -Math.PI / 2; slab.position.y = -SLAB + 0.1; slab.receiveShadow = slab.castShadow = true; group.add(slab);

  const [nx, ny] = res;
  const sgeo = new THREE.PlaneGeometry(MAP_W, MAP_H, nx, ny); sgeo.rotateX(-Math.PI / 2);
  const pos = sgeo.attributes.position, snowA = new Float32Array(pos.count), seamA = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const ax = pos.getX(i) + MAP_W / 2, ay = pos.getZ(i) + MAP_H / 2, h = geo.height(ax, ay);
    pos.setY(i, surf(ax, ay)); snowA[i] = h < 0 ? 0 : snowAt(ax, ay, h); seamA[i] = seam(ax, ay);
  }
  sgeo.setAttribute('aSnow', new THREE.BufferAttribute(snowA, 1)); sgeo.setAttribute('aSeam', new THREE.BufferAttribute(seamA, 1)); sgeo.computeVertexNormals();
  const maskTex = new THREE.CanvasTexture(geo.maskCanvas); maskTex.colorSpace = THREE.NoColorSpace;
  const uv = (v) => `vec2((${v}.x + ${(MAP_W / 2).toFixed(1)}) / ${MAP_W.toFixed(1)}, 1.0 - (${v}.z + ${(MAP_H / 2).toFixed(1)}) / ${MAP_H.toFixed(1)})`;
  const landMat = felt(new THREE.MeshStandardMaterial({ color: 0xffffff }), 'land', { key: 'map', extra: (sh) => {
    sh.uniforms.uMask = { value: maskTex }; sh.uniforms.uCol = { value: colTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSnow; attribute float aSeam; varying float vSnow; varying float vSeam;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSnow = aSnow; vSeam = aSeam;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask; uniform sampler2D uCol; varying float vSnow; varying float vSeam;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 muv = ${uv('vFP')};
          if (texture2D(uMask, muv).r < 0.5) discard;
          diffuseColor.rgb = texture2D(uCol, muv).rgb;                                         // the state's felt patch
          float nub = ffbm(vFP * 0.32) * 0.6 + ffbm(vFP * 1.1) * 0.4;                           // woolly, mottled felt
          diffuseColor.rgb *= 0.84 + 0.3 * nub;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.93, 0.89), smoothstep(0.15, 0.7, vSnow));   // batting snow
          diffuseColor.rgb *= 1.0 - 0.26 * smoothstep(0.3, 0.9, vSeam);                     // shade in the seam
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hn = ffbm(vFP * 0.32) * 0.55 + ffbm(vFP * 1.1) * 0.22;                              // the nubbly wool, as relief
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(hn), dhy = dFdy(hn);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 nb = abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2); normal = dot(nb, nb) > 1e-12 ? normalize(nb) : normal; }`);
  } });
  const land = new THREE.Mesh(sgeo, landMat); land.receiveShadow = land.castShadow = true; group.add(land);

  // ---------------- threads: instanced cylinders (a stitch is a short piece of floss lying on the felt)
  const threads = { coast: [], border: [], rail: [] };
  const addStitch = (list, a, b) => list.push([a, b]);
  const p3 = (ax, ay, lift = 0.12) => { const [x, z] = toWorld(ax, ay); return V(x, Math.max(0.3, surf(ax, ay)) + lift, z); };
  // coast: blanket stitch (a spoke into the felt every ~1.8 units, joined along the edge)
  for (const poly of polys) for (const ringPts of poly) {
    let acc = 0, prev = null;
    for (let i = 0; i < ringPts.length - 1; i++) {
      const [x0, y0] = ringPts[i], [x1, y1] = ringPts[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1e-6) continue;
      const tx = (x1 - x0) / L, ty = (y1 - y0) / L;
      let nxv = -ty, nyv = tx; if (!geo.inside(x0 + (x1 - x0) / 2 + nxv * 1.2, y0 + (y1 - y0) / 2 + nyv * 1.2)) { nxv = -nxv; nyv = -nyv; }
      for (let s = (3.4 - acc); s <= L; s += 3.4) {
        const ex = x0 + tx * s, ey = y0 + ty * s, edge = p3(ex, ey, 0.35), spoke = p3(ex + nxv * 2.6, ey + nyv * 2.6, 0.25);
        edge.y = Math.max(edge.y, 0.5); addStitch(threads.coast, edge, spoke);
        if (prev) addStitch(threads.coast, prev, edge);
        prev = edge;
      }
      acc = (acc + L) % 3.4;
    }
  }
  // a dashed stitch along any polyline of map points (ax, ay): dash length, period, lift
  const dashes = (list, line, dash, period, lift = 0.12, phase = 0) => {
    let acc = phase;
    for (let i = 0; i < line.length - 1; i++) {
      const [x0, y0] = line[i], [x1, y1] = line[i + 1], L = Math.hypot(x1 - x0, y1 - y0); if (L < 1e-6) continue;
      const tx = (x1 - x0) / L, ty = (y1 - y0) / L;
      for (let s = (period - acc) % period; s <= L; s += period) { const e = Math.min(L, s + dash); if (e - s > dash * 0.35) addStitch(list, p3(x0 + tx * s, y0 + ty * s, lift), p3(x0 + tx * e, y0 + ty * e, lift)); }
      acc = (acc + L) % period;
    }
  };
  // state borders: chunky gold stitches, like beads of floss along every seam
  for (const line of geo.borders.coordinates) dashes(threads.border, line, 1.7, 3.0, 0.2);
  // rivers: stitched in blue floss (stylised courses, for the picture map — not survey data)
  const rivers = RIVERS.map((r) => r.map(([lo, la]) => A48([lo, la]))).map((r) => r.filter(Boolean));
  threads.river = [];
  for (const r of rivers) { const sm = new THREE.CatmullRomCurve3(r.map(([x, y]) => V(x, 0, y)), false, 'centripetal'); const pts = sm.getSpacedPoints(Math.ceil(sm.getLength() / 1.5)).map((p) => [p.x, p.z]); dashes(threads.river, pts, 1.6, 2.5, 0.15); }
  // thread thickness follows the camera (threadScale, set by the page): chunky picture-map floss over the whole
  // country, slimming to real stitches as the camera comes down to a town
  const threadMesh = (list, radius, color, cast = false) => {
    const g = new THREE.CylinderGeometry(radius, radius, 1, 8, 1); g.translate(0, 0.5, 0);
    const m = felt(new THREE.MeshStandardMaterial({ color }), 'felt', { key: 'thread', extra: (sh) => {
      sh.uniforms.uThick = threadScale;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uThick;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.xz *= uThick; transformed.y = mix(transformed.y, 0.5, 0.0);');
    } });
    const im = new THREE.InstancedMesh(g, m, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0);
    list.forEach(([a, b], i) => { const d = b.clone().sub(a), L = d.length(); q.setFromUnitVectors(up, d.normalize()); m4.compose(a, q, V(1, L, 1)); im.setMatrixAt(i, m4); });
    im.castShadow = cast; im.receiveShadow = true; group.add(im); return im;
  };
  // chunky floss, sized for the picture map (a stitch reads at the whole-country view, as in the reference)
  threadMesh(threads.coast, 0.95, 0xebb53e, true);
  threadMesh(threads.border, 0.72, 0xe8b84e);
  threadMesh(threads.river, 0.75, 0x5f9cf0);

  // ---------------- navy felt sea with wavy running stitches; a wooden frame round it all
  const lakeC = document.createElement('canvas'); lakeC.width = MAP_W / 2; lakeC.height = MAP_H / 2;
  { const g = lakeC.getContext('2d'); g.scale(0.5, 0.5); g.fillStyle = '#000'; g.fillRect(0, 0, MAP_W, MAP_H); g.fillStyle = '#fff'; g.beginPath();
    LAKES.map(([lo, la]) => A48([lo, la])).filter(Boolean).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
  const lakeTex = new THREE.CanvasTexture(lakeC);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W * 1.32, MAP_H * 1.42),
    felt(new THREE.MeshStandardMaterial({ color: 0x1d2a5e }), 'sea', { key: 'sea', extra: (sh) => {
      sh.uniforms.uLake = { value: lakeTex };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uLake;').replace('#include <color_fragment>', `#include <color_fragment>
        { float lake = texture2D(uLake, ${uv('vFP')}).r;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.32, 0.66), lake);                    // the Great Lakes: brighter blue felt
          float sp = mix(16.0, 4.5, lake);
          float wy = vFP.z + mix(2.2, 0.6, lake) * sin(vFP.x * mix(0.05, 0.3, lake)) + 1.1 * sin(vFP.x * 0.13 + 1.7);
          float d = abs(fract(wy / sp) - 0.5) * sp;
          float th = fstitch(d, vFP.x + 3.0 * floor(wy / sp), mix(0.22, 0.14, lake), mix(2.4, 1.2, lake));
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.55, 0.64, 0.82), vec3(0.92, 0.94, 0.98), lake), th * 0.8); }`);
    } }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = SEA_Y; sea.receiveShadow = true; group.add(sea);
  const wood = felt(new THREE.MeshStandardMaterial({ color: 0x6b4a32 }), 'wood', { key: 'frame' });
  const base = new THREE.Mesh(new THREE.BoxGeometry(MAP_W * 1.36, 10, MAP_H * 1.46), wood); base.position.y = SEA_Y - 5.05; base.receiveShadow = true; group.add(base);
  for (const [w, d, x, z] of [[MAP_W * 1.38, 6, 0, MAP_H * 0.73], [MAP_W * 1.38, 6, 0, -MAP_H * 0.73], [6, MAP_H * 1.48, MAP_W * 0.69, 0], [6, MAP_H * 1.48, -MAP_W * 0.69, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 4.5, d), wood); b.position.set(x, SEA_Y + 1.2, z); b.castShadow = b.receiveShadow = true; group.add(b);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = SEA_Y - 10.2; group.add(floor);

  const surfaceY = (ax, ay) => Math.max(0.25, surf(ax, ay));
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), col = new THREE.Color();

  // ---------------- felt firs: three flattened felt tiers on a little dowel, a tuft of batting on the northern ones
  const layer = (r, h, y) => new THREE.ConeGeometry(r, h, 8).scale(1, 0.85, 1).translate(0, y, 0);
  const firBody = mergeGeometries([layer(0.66, 0.9, 0.85), layer(0.52, 0.8, 1.35), layer(0.36, 0.7, 1.8), new THREE.CylinderGeometry(0.09, 0.1, 0.5, 5).translate(0, 0.25, 0)]);
  const firSnow = new THREE.SphereGeometry(0.22, 7, 5).scale(1, 0.6, 1).translate(0, 2.15, 0);
  const firs = [];
  const target = tier === 'low' ? 2200 : tier === 'medium' ? 4200 : 7000;
  for (let i = 0; i < target * 12 && firs.length < target; i++) {
    const ax = rnd() * MAP_W, ay = rnd() * MAP_H, h = geo.height(ax, ay);
    if (h < 0.3 || rnd() > geo.forest(ax, ay, h) || seam(ax, ay) > 0.45) continue;   // not on the seams
    let nearSite = false; for (const s of Object.values(geo.sites)) if (Math.hypot(ax - s.a[0], ay - s.a[1]) < s.flatR * 1.3) nearSite = true;
    if (!nearSite) firs.push([ax, ay, 0.6 + rnd() * 0.7, rnd()]);
  }
  const imB = new THREE.InstancedMesh(firBody, felt(new THREE.MeshStandardMaterial({ color: 0xffffff }), 'felt', { key: 'fir' }), firs.length);
  const northern = firs.filter(([, ay]) => ay < 230);
  const imS = new THREE.InstancedMesh(firSnow, felt(new THREE.MeshStandardMaterial({ color: 0xf6f3ec }), 'snow', { key: 'firsnow' }), northern.length);
  let ns = 0;
  firs.forEach(([ax, ay, s, r], i) => {
    const [x, z] = toWorld(ax, ay);
    m4.compose(V(x, surfaceY(ax, ay) - 0.05, z), q.setFromAxisAngle(V(0, 1, 0), r * 6.3), sc.set(s, s * (0.9 + r * 0.3), s));
    imB.setMatrixAt(i, m4); imB.setColorAt(i, col.setHSL(0.37 + r * 0.05, 0.36, 0.24 + r * 0.08));
    if (ay < 230) imS.setMatrixAt(ns++, m4);
  });
  for (const im of [imB, imS]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }

  // ---------------- town clusters: little felt houses with a lit window each (generic places, not campaign locations)
  const houseGeo = (() => {
    const wall = new THREE.BoxGeometry(1, 0.8, 0.9, 1, 1, 1).translate(0, 0.4, 0);
    const tri = new THREE.Shape([new THREE.Vector2(-0.62, 0), new THREE.Vector2(0, 0.55), new THREE.Vector2(0.62, 0)]);
    const roof = new THREE.ExtrudeGeometry(tri, { depth: 1.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }).translate(0, 0.8, -0.54);
    for (const g of [wall, roof]) { g.deleteAttribute('uv'); }
    return mergeGeometries([wall.toNonIndexed(), roof.toNonIndexed()]);
  })();
  const winGeo = mergeGeometries([new THREE.BoxGeometry(0.22, 0.26, 0.04).translate(-0.22, 0.42, 0.46), new THREE.BoxGeometry(0.22, 0.26, 0.04).translate(0.22, 0.42, 0.46)]);
  const houses = [];
  const palette = [0xc8513f, 0x3d6fa8, 0xd98aa0, 0xe2c25a, 0x8fb59a, 0xe8dcc4, 0xb59ad0, 0xe59a5a];
  for (const [ax, ay] of geo.towns) {
    const n = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.3, d = rnd() * 2.6; houses.push([ax + Math.cos(a) * d, ay + Math.sin(a) * d, 0.6 + rnd() * 0.5, rnd() * 6.3, palette[Math.floor(rnd() * palette.length)]]); }
  }
  const imH = new THREE.InstancedMesh(houseGeo, felt(new THREE.MeshStandardMaterial({ color: 0xffffff }), 'felt', { key: 'house' }), houses.length);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffb050, emissiveIntensity: 1.6, roughness: 0.9 });
  const imW = new THREE.InstancedMesh(winGeo, winMat, houses.length);
  houses.forEach(([ax, ay, s, r, c], i) => { const [x, z] = toWorld(ax, ay); m4.compose(V(x, surfaceY(ax, ay) - 0.05, z), q.setFromAxisAngle(V(0, 1, 0), r), sc.set(s, s, s)); imH.setMatrixAt(i, m4); imW.setMatrixAt(i, m4); imH.setColorAt(i, col.set(c)); });
  imH.castShadow = imH.receiveShadow = true; group.add(imH, imW);

  // ---------------- rail routes: padded felt cords with a running stitch along the top, meeting at Toy Town
  const COLS = { red: 0xc8302a, blue: 0x2f5fb8, green: 0x2f8a46 };
  const lines = {};
  for (const [name, pts] of Object.entries(geo.lines)) {
    const ctrl = new THREE.CatmullRomCurve3(pts.map(([ax, ay]) => { const [x, z] = toWorld(ax, ay); return V(x, 0, z); }), false, 'centripetal');
    const L = ctrl.getLength(), N = Math.ceil(L / 2);
    const dense = []; for (let i = 0; i <= N; i++) { const p = ctrl.getPointAt(i / N); const ax = p.x + MAP_W / 2, ay = p.z + MAP_H / 2; p.y = Math.max(surfaceY(ax, ay), 0.3) + 0.45; dense.push(p); }
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < dense.length - 1; i++) dense[i].y = Math.max(dense[i].y, (dense[i - 1].y + dense[i + 1].y) / 2 - 0.2);
    const curve = new THREE.CatmullRomCurve3(dense, false, 'centripetal');
    // bold stitches in the route's colour, a small white stitch in each gap (like the reference's dashed routes)
    const cst = [], wst = []; const CL = curve.getLength();
    for (let s = 0.2; s + 3.6 < CL; s += 5.4) {
      const a = curve.getPointAt(s / CL), b = curve.getPointAt((s + 3.6) / CL), c = curve.getPointAt((s + 4.2) / CL), d = curve.getPointAt(Math.min(1, (s + 4.9) / CL));
      for (const p of [a, b, c, d]) p.y -= 0.1;
      cst.push([a, b]); wst.push([c, d]);
    }
    const mesh = threadMesh(cst, 1.05, COLS[name]); mesh.material.transparent = true;
    const sm = threadMesh(wst, 0.62, 0xf6eedc); sm.material.transparent = true;
    lines[name] = { curve, L: curve.getLength(), color: COLS[name], mesh, stitch: sm };
  }
  // little felt trains (engine + two cars) shuttle along each line
  const trains = Object.entries(lines).map(([name, ln], idx) => {
    const g = new THREE.Group(); group.add(g);
    const parts = [0, 1, 2].map((k) => {
      const p = new THREE.Group(); g.add(p);
      const bodyM = felt(new THREE.MeshStandardMaterial({ color: k === 0 ? 0x2a2630 : ln.color }), 'felt', { key: 'train' });
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.0), bodyM); b.position.y = 0.85; b.castShadow = true; p.add(b);
      if (k === 0) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 8), bodyM); c.position.set(0.7, 1.55, 0); p.add(c); }
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), felt(new THREE.MeshStandardMaterial({ color: 0xf6f3ec }), 'snow', { key: 'steam' }));
      if (k === 0) { puff.position.set(0.8, 2.25, 0); p.add(puff); }
      return p;
    });
    return { g, parts, ln, phase: idx * 0.33, speed: 9 + idx * 1.5 };
  });

  // ---------------- batting clouds drifting over the map
  const clouds = [];
  const cloudMat = felt(new THREE.MeshStandardMaterial({ color: 0xf7f4ee, transparent: true }), 'snow', { key: 'cloud' });
  const EDGE = [[-0.47, 0.36], [0.45, 0.33], [-0.5, -0.22], [0.5, -0.05], [0.1, 0.47], [-0.2, -0.47], [0.32, -0.46], [-0.42, 0.05]];
  for (let i = 0; i < (tier === 'low' ? 5 : EDGE.length); i++) {
    const parts = []; const n = 4 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) { const r = 8 + rnd() * 7; parts.push(new THREE.SphereGeometry(r, 12, 8).scale(1.4, 0.55, 1).translate((j - n / 2) * 6 + rnd() * 3, rnd() * 2, (rnd() - 0.5) * 7)); }
    const g = mergeGeometries(parts); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), w = 1 + 0.12 * (fbm(x * 0.2 + i, z * 0.2) - 0.5); p.setXYZ(k, x * w, y * w, z * w); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, cloudMat); m.position.set(EDGE[i][0] * MAP_W + (rnd() - 0.5) * 30, 18 + rnd() * 10, EDGE[i][1] * MAP_H + (rnd() - 0.5) * 20); m.castShadow = false;
    m.userData.y0 = m.position.y; group.add(m); clouds.push(m);
  }

  function update(dt, t) {
    for (const tr of trains) {
      const period = (tr.ln.L / tr.speed) * 2, u = ((t / period + tr.phase) % 1) * 2, fwd = u < 1, s = (fwd ? u : 2 - u) * tr.ln.L;
      tr.parts.forEach((p, i) => {
        const si = Math.min(tr.ln.L - 0.01, Math.max(0.01, s + (fwd ? -i : i) * 2.6)), k = si / tr.ln.L;
        p.position.copy(tr.ln.curve.getPointAt(k));
        const tg = tr.ln.curve.getTangentAt(k); p.rotation.set(0, Math.atan2(-tg.z, tg.x) + (fwd ? 0 : Math.PI), 0);
      });
    }
    clouds.forEach((c, i) => { c.position.y = c.userData.y0 + 1.2 * Math.sin(t * 0.25 + i); });   // a gentle bob, they stay at the edges
  }
  // the symbolic lines (and the clouds) belong to the map view: they fade away as the camera comes down into a town
  function setLineFade(k) {
    for (const ln of Object.values(lines)) { ln.mesh.material.opacity = k; ln.mesh.visible = k > 0.02; ln.mesh.castShadow = k > 0.9; ln.stitch.material.opacity = k; ln.stitch.visible = k > 0.02; }
    for (const tr of trains) tr.g.visible = k > 0.02;
    cloudMat.opacity = Math.min(0.95, k * 0.95); for (const c of clouds) c.visible = k > 0.02;
  }
  return { group, land, surfaceY, lines, trains, update, setLineFade, houses: imH, firs: imB };
}
