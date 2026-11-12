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
import { buildLandmarks } from './landmarks.js';
import { ecosystem } from './ecosystems.js';
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
// generic places in Canada, Mexico and the Caribbean for the little felt towns (not campaign locations)
const NEIGHBOUR_TOWNS = [[-123.1, 49.3], [-114.1, 51.0], [-113.5, 53.5], [-104.6, 50.4], [-97.1, 49.9], [-79.4, 43.7], [-75.7, 45.4], [-73.6, 45.5], [-71.2, 46.8],
  [-63.6, 44.6], [-89.2, 48.4], [-106.6, 52.1], [-66.1, 45.3], [-100.3, 25.7], [-106.1, 28.6], [-110.95, 29.1], [-103.3, 20.7], [-99.1, 19.4], [-89.6, 21.0],
  [-96.7, 17.1], [-110.3, 24.1], [-103.4, 25.5], [-82.4, 23.1], [-75.8, 20.0], [-90.5, 14.6], [-69.9, 18.5], [-66.1, 18.4]];
const SLAB = 6, SEA_Y = -2.6, PUFF = 0.9;
const noiseX = (x, y) => fbm(x * 0.03, y * 0.03) * 2 - 1;
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
  const [bx0, by0, bx1, by1] = geo.board, BW = bx1 - bx0, BH = by1 - by0, BX = (bx0 + bx1) / 2 - MAP_W / 2, BZ = (by0 + by1) / 2 - MAP_H / 2;
  // the ground under the quilt: gently rolling (the big ranges are the stuffed felt peaks), levelled for the story towns
  const siteFlat = (ax, ay) => { let k = 0; for (const st of Object.values(geo.sites)) k = Math.max(k, sstep(st.flatR * 2.2, st.flatR * 1.4, Math.hypot(ax - st.a[0], ay - st.a[1]))); return k; };
  const soft = (h) => (h <= 2.4 ? h : 2.4 + (h - 2.4) * 0.22);
  const mound = (ax, ay) => { const h = soft(geo.height(ax, ay)); return h < 0 ? 0.2 : h + 0.25; };
  const surf = (ax, ay) => (geo.inside(ax, ay) ? mound(ax, ay) + 0.15 * (1 - siteFlat(ax, ay)) : -6);   // the felt's top

  // ---------------- the backing under the land (the cut edge of the quilt shows round the coast), all countries
  const shapes = [];
  const ng = geo.nation.features ? geo.nation.features[0].geometry : geo.nation.geometry;
  const polys = ng.type === 'Polygon' ? [ng.coordinates] : ng.coordinates;
  const nPolys = (geo.neighbours ? geo.neighbours.features : []).flatMap((f) => f.geometry.coordinates);
  for (const poly of [...polys, ...nPolys]) {
    const ring = (r) => r.map(([x, y]) => new THREE.Vector2(x - MAP_W / 2, MAP_H / 2 - y));
    const s = new THREE.Shape(ring(poly[0])); for (const hole of poly.slice(1)) s.holes.push(new THREE.Path(ring(hole))); shapes.push(s);
  }
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shapes, { depth: SLAB, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 3, curveSegments: 2 }),
    felt(new THREE.MeshStandardMaterial({ color: 0xe9dcc2 }), 'felt', { key: 'slab' }));   // a cream backing, like the cut edge of a quilt
  slab.rotation.x = -Math.PI / 2; slab.position.y = -SLAB + 0.1; slab.receiveShadow = slab.castShadow = true; group.add(slab);

  // ---------------- the land: one continuous felt surface whose colour drifts between ecosystems (boreal forest,
  // prairie, desert, mountains, tundra, tropics…) — never changing at a state line — woolly and mottled in the shader,
  // the coast cut per pixel from the land mask
  const maskTex = new THREE.CanvasTexture(geo.maskCanvas); maskTex.colorSpace = THREE.NoColorSpace;
  const uv = (v) => `vec2((${v}.x + ${(MAP_W / 2 - bx0).toFixed(2)}) / ${BW.toFixed(2)}, 1.0 - (${v}.z + ${(MAP_H / 2 - by0).toFixed(2)}) / ${BH.toFixed(2)})`;
  const ECO = { forest: 0x4f7f4a, boreal: 0x36593f, gold: 0xd8b05a, rust: 0xc26c45, peach: 0xdca07c, olive: 0x8f9c58, mountain: 0x8a8098, snow: 0xeeeae2, autumn: 0xc4743c, tropic: 0x4f9a6a };
  const ecoCol = Object.fromEntries(Object.entries(ECO).map(([k, v]) => [k, new THREE.Color(v)]));
  const ecoAt = (ax, ay, out) => {   // the ecosystem colour, averaged over a few nearby points so neighbouring ecosystems blend
    out.setRGB(0, 0, 0); let n = 0;
    for (const [dx, dy] of [[0, 0], [9, 4], [-6, 8], [-8, -6], [5, -9]]) {
      const qx = ax + dx + noiseX(ax, ay) * 14, qy = ay + dy + noiseX(ay + 31, ax) * 14;
      const mix = ecosystem(geo, geo.inside(qx, qy) ? qx : ax, geo.inside(qx, qy) ? qy : ay, geo.height(ax, ay));
      for (const [f, w] of Object.entries(mix)) { out.r += ecoCol[f].r * w; out.g += ecoCol[f].g * w; out.b += ecoCol[f].b * w; } n++;
    }
    return out.multiplyScalar(1 / n);
  };
  const res = tier === 'high' ? [900, 640] : tier === 'medium' ? [600, 430] : [380, 270];
  const sgeo = new THREE.PlaneGeometry(BW, BH, res[0], res[1]); sgeo.rotateX(-Math.PI / 2); sgeo.translate(BX, 0, BZ);
  const pos = sgeo.attributes.position, cols = new Float32Array(pos.count * 3), tmp = new THREE.Color(), snowC = new THREE.Color(0xf2efe8);
  for (let i = 0; i < pos.count; i++) {
    const ax = pos.getX(i) + MAP_W / 2, ay = pos.getZ(i) + MAP_H / 2, inside = geo.inside(ax, ay);
    pos.setY(i, inside ? mound(ax, ay) + 0.15 * (1 - siteFlat(ax, ay)) : 0.1);
    if (inside) { ecoAt(ax, ay, tmp); tmp.lerp(snowC, siteFlat(ax, ay) * 0.9); } else tmp.setRGB(0.2, 0.2, 0.2);
    cols.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  sgeo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); sgeo.computeVertexNormals();
  const landMat = felt(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true }), 'land', { key: 'eco', extra: (sh) => {
    sh.uniforms.uMask = { value: maskTex };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMask;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { if (texture2D(uMask, ${uv('vFP')}).r < 0.5) discard;
          float nub = ffbm(vFP * 0.3) * 0.6 + ffbm(vFP * 1.1) * 0.4;                 // woolly, mottled felt
          diffuseColor.rgb *= 0.86 + 0.26 * nub;
          diffuseColor.rgb *= 1.0 - 0.18 * texture2D(uMask, ${uv('vFP')}).g;        // the state lines pressed in a little
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hn = ffbm(vFP * 0.3) * 0.5 + ffbm(vFP * 1.1) * 0.2;
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
  const onBoard = (ax, ay) => ax > bx0 + 2 && ax < bx1 - 2 && ay > by0 + 2 && ay < by1 - 2;
  for (const [poly, us] of [...polys.map((p) => [p, true]), ...nPolys.map((p) => [p, false])]) for (const ringPts of poly) {
    let acc = 0, prev = null;
    for (let i = 0; i < ringPts.length - 1; i++) {
      const [x0, y0] = ringPts[i], [x1, y1] = ringPts[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1e-6) continue;
      const tx = (x1 - x0) / L, ty = (y1 - y0) / L;
      let nxv = -ty, nyv = tx; if (!geo.inside(x0 + (x1 - x0) / 2 + nxv * 1.2, y0 + (y1 - y0) / 2 + nyv * 1.2)) { nxv = -nxv; nyv = -nyv; }
      for (let s = (3.4 - acc); s <= L; s += 3.4) {
        const ex = x0 + tx * s, ey = y0 + ty * s;
        // one stitch line on a land border: the neighbour's ring leaves out what the US ring already sews
        if (!onBoard(ex, ey) || (!us && geo.region(ex - nxv * 2.5, ey - nyv * 2.5) === 'us')) { prev = null; continue; }
        const edge = p3(ex, ey, 0.35), spoke = p3(ex + nxv * 2.6, ey + nyv * 2.6, 0.25);
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
  for (const line of geo.borders.coordinates) dashes(threads.border, line, 1.1, 2.4, 0.2);   // state lines: a light running stitch only
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
  threadMesh(threads.border, 0.42, 0xefd9a0);
  threadMesh(threads.river, 0.75, 0x5f9cf0);

  // ---------------- navy felt sea with wavy running stitches; a wooden frame round it all
  const lakeC = document.createElement('canvas'); lakeC.width = Math.round(BW / 2); lakeC.height = Math.round(BH / 2);
  { const g = lakeC.getContext('2d'); g.scale(0.5, 0.5); g.translate(-bx0, -by0); g.fillStyle = '#000'; g.fillRect(bx0, by0, BW, BH); g.fillStyle = '#fff'; g.beginPath();
    LAKES.map(([lo, la]) => A48([lo, la])).filter(Boolean).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
  const lakeTex = new THREE.CanvasTexture(lakeC);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(BW + 40, BH + 40),
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
  sea.rotation.x = -Math.PI / 2; sea.position.set(BX, SEA_Y, BZ); sea.receiveShadow = true; group.add(sea);
  const wood = felt(new THREE.MeshStandardMaterial({ color: 0x6b4a32 }), 'wood', { key: 'frame' });
  // the display: the quilt on a wooden board with a raised frame, on a plinth (a museum piece)
  const base = new THREE.Mesh(new THREE.BoxGeometry(BW + 48, 10, BH + 48), wood); base.position.set(BX, SEA_Y - 5.05, BZ); base.receiveShadow = true; group.add(base);
  for (const [w, d, x, z] of [[BW + 52, 8, 0, BH / 2 + 24], [BW + 52, 8, 0, -BH / 2 - 24], [8, BH + 56, BW / 2 + 24, 0], [8, BH + 56, -BW / 2 - 24, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), wood); b.position.set(BX + x, SEA_Y + 1.6, BZ + z); b.castShadow = b.receiveShadow = true; group.add(b);
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(BW + 140, 60, BH + 140), new THREE.MeshStandardMaterial({ color: 0x2a2226, roughness: 0.85 }));
  plinth.position.set(BX, SEA_Y - 40.1, BZ); plinth.receiveShadow = true; group.add(plinth);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = SEA_Y - 10.2; group.add(floor);

  const surfaceY = (ax, ay) => Math.max(0.25, surf(ax, ay));
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(), col = new THREE.Color();

  // ---------------- felt firs: three flattened felt tiers on a little dowel, a tuft of batting on the northern ones
  const layer = (r, h, y) => new THREE.ConeGeometry(r, h, 8).scale(1, 0.85, 1).translate(0, y, 0);
  const firBody = mergeGeometries([layer(0.66, 0.9, 0.85), layer(0.52, 0.8, 1.35), layer(0.36, 0.7, 1.8), new THREE.CylinderGeometry(0.09, 0.1, 0.5, 5).translate(0, 0.25, 0)]);
  const firSnow = new THREE.SphereGeometry(0.22, 7, 5).scale(1, 0.6, 1).translate(0, 2.15, 0);
  const firs = [];
  const target = tier === 'low' ? 3000 : tier === 'medium' ? 6000 : 10000;
  for (let i = 0; i < target * 12 && firs.length < target; i++) {
    const ax = bx0 + rnd() * BW, ay = by0 + rnd() * BH, h = geo.height(ax, ay);
    if (h < 0.3 || rnd() > geo.forest(ax, ay, h)) continue;
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
  for (const [ax, ay] of [...geo.towns, ...NEIGHBOUR_TOWNS.map(([lo, la]) => A48([lo, la]))]) {
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
  const EDGE = [[-0.4, 0.3], [0.44, 0.36], [-0.46, -0.3], [0.47, -0.1], [0.12, 0.47], [-0.15, -0.46], [0.34, -0.42], [-0.3, 0.46]];
  for (let i = 0; i < (tier === 'low' ? 5 : EDGE.length); i++) {
    const parts = []; const n = 4 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) { const r = 8 + rnd() * 7; parts.push(new THREE.SphereGeometry(r, 12, 8).scale(1.4, 0.55, 1).translate((j - n / 2) * 6 + rnd() * 3, rnd() * 2, (rnd() - 0.5) * 7)); }
    const g = mergeGeometries(parts); const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k), w = 1 + 0.12 * (fbm(x * 0.2 + i, z * 0.2) - 0.5); p.setXYZ(k, x * w, y * w, z * w); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, cloudMat); m.position.set(BX + EDGE[i][0] * BW + (rnd() - 0.5) * 30, 18 + rnd() * 10, BZ + EDGE[i][1] * BH + (rnd() - 0.5) * 20); m.castShadow = false;
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
  const landmarks = buildLandmarks(group, geo, surfaceY, { tier });
  return { group, land, surfaceY, lines, trains, update, setLineFade, houses: imH, firs: imB, landmarks };
}
