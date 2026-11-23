// Toy Town · the red truck's donation and collection (Phase 1, Milestone 2A). About 26 seconds in two visitor-paced
// beats, played live in the Toy Town street:
//   Beat 1 · the donation (0–13.5 s): a parent and child walk up the street; the child carries a small red toy truck,
//            lifts it over the toy drop-off box and lowers it through the slot; it drops onto the toys inside; the box
//            glows; the child looks up at the parent; the volunteer by the hall waves; the family steps aside.
//   Beat 2 · the collection (13.5–26.5 s): the Marine by the wagon walks to the box, lifts its lid, reaches in and
//            lifts out the carton of toys (the red truck on top: it fell there in beat 1, so it never teleports), carries
//            it to the community hall while the volunteer opens the door; warm light spills out; both go in; the door
//            swings shut and the hall's glow sets up the next scene (sorting).
// Town life runs on the wall clock and never waits: chimney smoke, a neighbour shovelling snow, passers-by, snow,
// lamps, the tree's lights.
//
// Like Chapter 1 (chapter1.js, kept for ?town=maple), everything is a pure function of story time t (plus wall-clock w
// for the ambient life), so a beat can be played, held, paused for the finder, jumped to or replayed exactly. Characters
// are the Chapter 1 cast and clips; new gestures (reaching, lifting, opening, shovelling) are built on their bones with a
// two-bone arm reach, a spine bend and a head look. Puppets move on twos (12 poses a second), like stop-motion.
// All positions are Toy Town's own units (the street model's space).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadGLB, S } from './community.js';
import { clay as claySurface, LOOK, timeU } from './clay.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSorting, HALL } from './scene_sorting.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const angLerp = (a, b, k) => { const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; };
const yawOf = (d) => Math.atan2(d.x, d.z);
const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
const backOut = (x) => { x = clamp(x); const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };   // a little overshoot
const settle = (x) => { x = clamp(x); return 1 - Math.exp(-6 * x) * Math.cos(9 * x); };                                     // swing, bounce back, rest

// trapezoid speed profile: start at t0, cover L at speed v, easing in and out over e seconds
function travel(t, t0, L, v, e = 0.6) {
  const Tt = L / v + e, a = v / e, u = t - t0;
  if (u <= 0) return { s: 0, v: 0 };
  if (u >= Tt) return { s: L, v: 0 };
  if (u < e) return { s: 0.5 * a * u * u, v: a * u };
  if (u > Tt - e) { const r = Tt - u; return { s: L - 0.5 * a * r * r, v: a * r }; }
  return { s: 0.5 * a * e * e + v * (u - e), v };
}
const walkTime = (L, v, e = 0.6) => L / v + e;

// ------------------------------------------------------------------ the script (story time, seconds)
export const BEATS = { donation: [0, 13.5], collection: [13.5, 28], sorting: [28, 48] };   // collection's end is set from the walks below; sorting's by scene_sorting.js
const T = {
  // beat 1
  walk0: 1.0,                 // the family sets off
  lift0: 7.55, lift1: 8.35,   // the child lifts the truck over the box
  show1: 8.85,                // …holds it there a moment
  lower1: 9.35,               // …lowers it into the slot
  drop1: 9.7,                 // …lets go; it lands on the toys inside
  up0: 10.0, up1: 10.6,       // the child looks up at the parent
  wave0: 10.2, wave1: 11.5,   // the volunteer waves and nods
  aside0: 11.7,               // the family steps aside
  // beat 2 (the rest follows from the Marine's walk: see createDonation)
  m0: 13.6,                   // the Marine looks up from the wagon
  mWalk0: 13.85,              // …walks to the box
};

// places (Toy Town units: x along the street, z towards the near sidewalk, y up)
const BOX = { x: 2.3, z: 1.25, w: 1.05, h: 0.755, d: 0.75 };
const BOX_BACK = BOX.z - BOX.d / 2, BOX_FRONT = BOX.z + BOX.d / 2;
const SLOT = V(BOX.x, BOX.h, BOX_FRONT - 0.2);              // the slot sits near the front edge, within a child's reach
const CARTON_BASE = 0.055;                                   // the carton stands on the box's floor
const DOOR = { hingeX: -0.7, z: 0.09, w: 1.4, h: 2.4, y: 1.22, faceZ: 0.03 };
const WAGON = [-2.05, 0.78];
const BENCH = { x0: -4.25, x1: -2.45, z0: 1.35, z1: 1.92 };   // the street's bench, beside the wagon (kept clear of)
const VOL = V(1.35, 0, 0.85);

export async function createDonation(town, { assets = './assets/', b64 = null, tier = 'high' } = {}) {
  const root = town.root;
  const load = (n) => loadGLB(assets + n, b64 && b64[n]);
  const [gm, gp, gc, gv, gprops] = await Promise.all(['marine.glb', 'ch1_parent.glb', 'ch1_child.glb', 'ch1_volunteer.glb', 'ch1_props.glb'].map(load));
  const group = new THREE.Group(); group.name = 'DonationScene'; root.add(group);
  const clipPlane = new THREE.Plane(V(0, 0, 1), 0);                  // the hall's doorway: who walks in is cut there

  // ---------------------------------------------------------------- hand-sculpted puppets
  // The puppets' shapes were perfect primitives: next to the lumpy, handmade buildings they read as plastic toys. Their
  // surfaces get a gentle unevenness (pressed by hand: the silhouette and the shading both), and a faint "boil" that
  // changes 12 times a second, the way a stop-motion puppet's clay shifts a little between frames.
  function sculpted(mat, skin = false) {
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uT = timeU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        uniform float uT;
        float sculptF(vec3 p) { return sin(p.x * 7.1 + 1.3) * sin(p.y * 6.3 + 0.7) * sin(p.z * 7.7 + 2.1) + 0.5 * sin(p.x * 13.3 - p.z * 11.1 + p.y * 3.0); }
        vec3 sculptG(vec3 p) { return vec3(7.1 * cos(p.x * 7.1 + 1.3) * sin(p.y * 6.3 + 0.7) * sin(p.z * 7.7 + 2.1) + 6.65 * cos(p.x * 13.3 - p.z * 11.1 + p.y * 3.0),
          6.3 * sin(p.x * 7.1 + 1.3) * cos(p.y * 6.3 + 0.7) * sin(p.z * 7.7 + 2.1) + 1.5 * cos(p.x * 13.3 - p.z * 11.1 + p.y * 3.0),
          7.7 * sin(p.x * 7.1 + 1.3) * sin(p.y * 6.3 + 0.7) * cos(p.z * 7.7 + 2.1) - 5.55 * cos(p.x * 13.3 - p.z * 11.1 + p.y * 3.0)); }`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float sculptB = fract(sin(floor(uT * 12.0) * 12.9898) * 43758.5453);            // the boil: a new frame on twos
        vec3 sculptP = position + vec3(sculptB * 0.04, sculptB * 0.03, -sculptB * 0.05);
        vec3 sculptN = objectNormal; float sculptA = 0.0055;
        { vec3 gq = sculptG(sculptP); objectNormal = normalize(objectNormal - sculptA * 1.6 * (gq - dot(gq, objectNormal) * objectNormal)); }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += sculptN * sculptA * sculptF(sculptP);`);
      // pressed wool: the felt look's own relief is sized for walls and reads as smooth paint at puppet scale. Here the
      // wool is uneven in colour (thicker and thinner patches), with fine fibre on top and a relief the light can catch.
      // It fades below a pixel, like the town's felt (no shimmer at a distance). Skin is the same wool, gentler.
      if (sh.fragmentShader.includes('varying vec3 vFP')) {
        const k = skin ? 0.55 : 1.0;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <color_fragment>', `#include <color_fragment>
            vec3 woolQ = vFP * 95.0; float woolA = 1.0 - smoothstep(0.35, 1.2, length(fwidth(woolQ)));
            float woolN1 = ffbm(woolQ), woolN2 = fvn(woolQ * 4.3 + 1.7);
            diffuseColor.rgb *= mix(1.0, 1.0 + ${(0.6 * k).toFixed(3)} * (woolN1 - 0.45) + ${(0.22 * k).toFixed(3)} * (woolN2 - 0.5), woolA);`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            { float h = (0.65 * woolN1 + 0.35 * woolN2) * ${(0.0022 * k).toFixed(5)} * woolA;
              vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float dhx = dFdx(h), dhy = dFdy(h);
              vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
              vec3 nb = abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2); normal = dot(nb, nb) > 1e-12 ? normalize(nb) : normal; }`);
      }
    };
    mat.customProgramCacheKey = () => key + '-sculpted' + (skin ? '-s' : '');
  }

  // ---------------------------------------------------------------- the cast (Chapter 1's sculpts, rig and clips)
  // eyelids: the eye shapes squash toward their own middle (before skinning), a blink on twos. No new geometry.
  function eyelid(mat, geo, u) {
    geo.computeBoundingBox(); const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
    const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uBlink = u;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBlink;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.y = mix(transformed.y, ${cy.toFixed(5)}, uBlink);`);
    };
    mat.customProgramCacheKey = () => key + '-lid' + cy.toFixed(4);
  }
  function makeChar(g, { scale = 1, colors = [], clip = false } = {}) {
    const obj = skClone(g.scene), blink = { value: 0 };
    obj.scale.setScalar(scale);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const many = Array.isArray(o.material), out = (many ? o.material : [o.material]).map((m) => {
        const c = m.clone();
        for (const [re, col] of colors) if (re.test(m.name)) c.color.set(col);
        const felt = (m.userData && m.userData.kind === 'felt') || /Coat|Trouser/.test(m.name);
        claySurface(c, felt ? 'fabric' : 'clay', true, S * scale);
        if (!/Eye|Cheek/.test(m.name)) sculpted(c, /Skin/.test(m.name));
        if (/Eye/.test(m.name)) eyelid(c, o.geometry, blink);
        if (clip) c.clippingPlanes = [clipPlane];
        return c;
      });
      o.material = many ? out : out[0];
    });
    group.add(obj);
    const mixer = new THREE.AnimationMixer(obj), acts = {};
    for (const c of g.animations) { const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); acts[c.name] = a; }
    const bones = {}, rest = []; obj.traverse((o) => { if (o.isBone) { bones[o.name.replace(/\./g, '')] = o; rest.push([o, o.quaternion.clone(), o.position.clone()]); } });
    return { obj, mixer, acts, bones, rest, scale, stride: 1.3 * scale, blink };
  }
  const marine = makeChar(gm, { clip: true });
  const parent = makeChar(gp);
  const child = makeChar(gc, { scale: 0.64 });
  const volunteer = makeChar(gv, { clip: true });
  const passer = makeChar(gp, { colors: [[/PCoat/, 0x6b3d6e], [/PHat/, 0x3e8a8c], [/PScarf/, 0xf0e2c4], [/PMitt/, 0x3e8a8c]] });
  const passer2 = makeChar(gv, { colors: [[/PCoat|PVest/, 0xd9a93f], [/PHat/, 0x2d5fae], [/PSkin/, 0xc98a62], [/PHair/, 0x2a1a12]] });
  const passerKid = makeChar(gc, { scale: 0.6, colors: [[/PCoat/, 0xa8322f], [/PHat/, 0x3f6f57], [/PSkin/, 0xc98a62]] });
  const shoveller = makeChar(gp, { colors: [[/PCoat/, 0x2f5d46], [/PHat/, 0xc8302a], [/PScarf/, 0xe8c55a], [/PMitt/, 0xc8302a], [/PSkin/, 0xd7a07a]] });

  // ---------------------------------------------------------------- props (cloned, own materials: the doorway cut is theirs alone)
  const prop = (name, { clip = false } = {}) => {
    const o = gprops.scene.getObjectByName(name).clone(true);
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      m.material = m.material.clone();
      if (LOOK.felt) LOOK.townScale = S; claySurface(m.material, 'clay', false); if (LOOK.felt) LOOK.townScale = null;
      if (clip) m.material.clippingPlanes = [clipPlane];
    });
    group.add(o); return o;
  };
  const truck = prop('Truck', { clip: true });
  const carton = prop('Carton', { clip: true });
  const wagon = prop('Wagon');
  { const t = wagon.getObjectByName('Wagon_truck'); if (t) t.visible = false; }   // one red truck in this story: the child's
  // the ground under a foot: street, sidewalk, curb, drifts and steps, never the snow on a bench, a sill or a roof (the
  // town's own lookup takes the first surface below 1.6 units, which put a puppet standing beside the bench on top of it)
  const groundMeshes = []; root.traverse((o) => { if (o.isMesh && /^(Snow|GroundSnow|Cobble|Curb|Footing)/.test(o.name)) groundMeshes.push(o); });
  const grc = new THREE.Raycaster(), gcache = new Map();
  function ground(x, z) {
    const k = Math.round(x * 24) + ',' + Math.round(z * 24); if (gcache.has(k)) return gcache.get(k);
    root.updateMatrixWorld(true); grc.set(root.localToWorld(V(Math.round(x * 24) / 24, 0.42, Math.round(z * 24) / 24)), V(0, -1, 0)); grc.far = 0.9 * S;
    let y = 0; for (const h of grc.intersectObjects(groundMeshes, false)) { const ly = root.worldToLocal(h.point.clone()).y; if (ly <= 0.36) { y = ly; break; } }
    gcache.set(k, y); return y;
  }
  // where a puppet stands: the lowest point of a foot-sized patch, so feet press into a drift rather than hover over a dip
  const footing = (x, z, r = 0.09) => Math.min(ground(x, z), ground(x + r, z), ground(x - r, z), ground(x, z + r), ground(x, z - r));
  const place = (o, x, z, yaw, s = 1) => { o.position.set(x, footing(x, z), z); o.rotation.set(0, yaw, 0); o.scale.setScalar(s); };
  place(wagon, WAGON[0], WAGON[1], 0.0, 1.05);
  carton.scale.setScalar(1.0);
  // the carton: cardboard has grain and a little wear, and someone has written TOYS on its sides in marker
  carton.traverse((o) => {
    if (!o.isMesh || !/Cardboard|CardTape/.test(o.material.name)) return;
    const mat = o.material, prev = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
    mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); if (!sh.fragmentShader.includes('varying vec3 vFP')) return;
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 q = vFP * 260.0; float a = 1.0 - smoothstep(0.35, 1.2, length(fwidth(q)));
          diffuseColor.rgb *= mix(1.0, 0.9 + 0.14 * ffbm(q * 0.25) + 0.06 * fvn(q * vec3(0.4, 6.0, 0.4)), a); }`); };
    mat.customProgramCacheKey = () => key + '-card';
  });
  { carton.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(carton), c = carton.worldToLocal(bb.getCenter(V()));
    const lo = carton.worldToLocal(bb.min.clone()), hi = carton.worldToLocal(bb.max.clone()), size = hi.clone().sub(lo);   // (carton units)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
    x.translate(128, 66); x.rotate(-0.06); x.fillStyle = 'rgba(62,36,24,0.86)'; x.font = '700 70px "Fraunces", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('TOYS', -10, 0); x.strokeStyle = 'rgba(62,36,24,0.7)'; x.lineWidth = 4; x.beginPath(); x.moveTo(-82, 34); x.quadraticCurveTo(-10, 46, 66, 30); x.stroke();
    x.fillStyle = 'rgba(176,42,36,0.9)'; x.beginPath(); x.moveTo(98, -6); x.bezierCurveTo(98, -20, 80, -20, 80, -8); x.bezierCurveTo(80, 2, 98, 12, 98, 18); x.bezierCurveTo(98, 12, 116, 2, 116, -8); x.bezierCurveTo(116, -20, 98, -20, 98, -6); x.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const dm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, clippingPlanes: [clipPlane] });
    const w = Math.min(size.x, size.z) > 0 ? (size.x >= size.z ? size.x : size.z) * 0.62 : 0.2;
    for (const sgn of [1, -1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), dm);
      if (size.x >= size.z) { d.position.set(c.x, lo.y + (hi.y - lo.y) * 0.45, sgn > 0 ? hi.z + 0.003 : lo.z - 0.003); d.rotation.y = sgn > 0 ? 0 : Math.PI; }
      else { d.position.set(sgn > 0 ? hi.x + 0.003 : lo.x - 0.003, lo.y + (hi.y - lo.y) * 0.45, c.z); d.rotation.y = sgn > 0 ? Math.PI / 2 : -Math.PI / 2; }
      carton.add(d);
    } }

  // ---------------------------------------------------------------- cutting pieces out of the street model
  // The street model merges everything of one material into one mesh (all the town's holly, all its cream wood…), so
  // the box's old top and the door's wreath can't simply be hidden or moved. carve() takes the triangles of a mesh that
  // lie wholly inside a region (town units) out of it; with keep, they come back as a mesh of their own (same material).
  function carve(name, [x0, x1, y0, y1, z0, z1], keep = false) {
    let src = null; root.traverse((o) => { if (!src && o.isMesh && o.name === name && o.parent && o.parent.name !== 'DonationScene') src = o; });
    if (!src || !src.geometry.index) return null;
    root.updateMatrixWorld(true);
    const g = src.geometry, P = g.attributes.position, I = g.index.array, v = V(), inR = new Uint8Array(P.count);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); src.localToWorld(v); root.worldToLocal(v); inR[i] = v.x > x0 && v.x < x1 && v.y > y0 && v.y < y1 && v.z > z0 && v.z < z1 ? 1 : 0; }
    const rest = [], out = [];
    for (let i = 0; i < I.length; i += 3) (inR[I[i]] && inR[I[i + 1]] && inR[I[i + 2]] ? out : rest).push(I[i], I[i + 1], I[i + 2]);
    if (!out.length) return null;
    g.setIndex(rest);
    if (!keep) return true;
    const piece = new THREE.Mesh(g.clone().setIndex(out), src.material); piece.name = name + '_carved';
    piece.castShadow = src.castShadow; piece.receiveShadow = src.receiveShadow;
    src.parent.add(piece); piece.position.copy(src.position); piece.quaternion.copy(src.quaternion); piece.scale.copy(src.scale); piece.updateMatrixWorld(true);
    return piece;
  }
  // reshape(): move a carved piece's corners in town units (f takes and changes a town-space point)
  function reshape(piece, f) {
    if (!piece) return; root.updateMatrixWorld(true);
    const P = piece.geometry.attributes.position, v = V(), used = new Set(piece.geometry.index.array);
    for (const i of used) { v.fromBufferAttribute(P, i); piece.localToWorld(v); root.worldToLocal(v); f(v); root.localToWorld(v); piece.worldToLocal(v); P.setXYZ(i, v.x, v.y, v.z); }
    P.needsUpdate = true; piece.geometry.computeBoundingBox(); piece.geometry.computeBoundingSphere();
  }

  // punch(): a hole through a mesh's front face (its triangles with every corner in front of zMin), for the hall's door.
  // The hall's wall is one solid lump of clay; the triangles over the doorway are cut against the opening's rectangle
  // and what lies outside it is kept (as a mesh of its own, same material). Town units.
  function punch(name, zMin, [x0, x1, y1], zMax = 1) {
    let src = null; root.traverse((o) => { if (!src && o.isMesh && o.name === name && o.parent && o.parent.name !== 'DonationScene') src = o; });
    if (!src || !src.geometry.index) return null;
    root.updateMatrixWorld(true);
    const g = src.geometry, P = g.attributes.position, I = g.index.array, pts = [];
    for (let i = 0; i < P.count; i++) pts.push(root.worldToLocal(src.localToWorld(V().fromBufferAttribute(P, i))));
    const clip = (poly, f) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a); if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) out.push(a.clone().lerp(b, fa / (fa - fb))); } return out; };
    const keep = [], cut = [];
    for (let i = 0; i < I.length; i += 3) {
      const t = [pts[I[i]], pts[I[i + 1]], pts[I[i + 2]]];
      const front = t.every((v) => v.z > zMin && v.z < zMax), over = Math.max(...t.map((v) => v.x)) > x0 && Math.min(...t.map((v) => v.x)) < x1 && Math.min(...t.map((v) => v.y)) < y1;
      if (!front || !over) { keep.push(I[i], I[i + 1], I[i + 2]); continue; }
      for (const region of [[(v) => v.x - x0], [(v) => x1 - v.x], [(v) => x0 - v.x, (v) => v.x - x1, (v) => y1 - v.y]]) {
        let poly = t; for (const f of region) { poly = clip(poly, f); if (poly.length < 3) break; }
        for (let k = 1; k + 1 < poly.length; k++) cut.push(poly[0], poly[k], poly[k + 1]);
      }
    }
    g.setIndex(keep);
    const ng = new THREE.BufferGeometry().setFromPoints(cut); ng.computeVertexNormals();
    const m = new THREE.Mesh(ng, src.material); m.name = name + '_doorway'; m.castShadow = src.castShadow; m.receiveShadow = true; root.add(m);
    return m;
  }

  // ---------------------------------------------------------------- softer cobbles
  // The street's cobbles were tall, faceted, dark stones: angular and loud against the soft snow and felt. They are
  // pressed lower, their facets smoothed into rounded pebbles, their colour softened, and their tops dusted with snow.
  { let cob = null; root.traverse((o) => { if (o.isMesh && o.name === 'Cobble' && !cob) cob = o; });
    if (cob) {
      const g0 = cob.geometry.clone(); g0.deleteAttribute('normal');
      const P0 = g0.attributes.position, pos = new Float32Array(P0.count * 3);
      for (let i = 0; i < P0.count; i++) pos.set([P0.getX(i), P0.getY(i) * 0.55, P0.getZ(i)], i * 3);
      g0.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const g = mergeVertices(g0, 1e-4); g.computeVertexNormals();
      const N = g.attributes.normal, P = g.attributes.position, col = new Float32Array(P.count * 3), stone = new THREE.Color(0x8f7c6e), snow = new THREE.Color(0xeef0f6), c = new THREE.Color();
      for (let i = 0; i < P.count; i++) {
        const h = Math.abs(Math.sin(Math.round(P.getX(i) * 60) * 12.9898 + Math.round(P.getZ(i) * 60) * 78.233) * 43758.5453) % 1;   // a little per-stone variation
        c.copy(stone).multiplyScalar(0.88 + 0.22 * h).lerp(snow, 0.42 * smooth((N.getY(i) - 0.75) / 0.25));
        col.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      cob.geometry = g; cob.material.vertexColors = true; cob.material.color.set(0xffffff); cob.material.needsUpdate = true;
      // Even pressed flat, those stones were too big: in the opening shots a dozen of them filled the foreground. The street
      // is shown instead as a laid surface of small rounded setts (about a third of the size) with snow in the joints:
      // one painted plane with a bump. The stone mesh stays, unseen, as the ground the puppets' feet find.
      cob.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(cob), lo = root.worldToLocal(bb.min.clone()), hi = root.worldToLocal(bb.max.clone());
      const SZ = 1024, cv = document.createElement('canvas'), bm = document.createElement('canvas'); cv.width = cv.height = bm.width = bm.height = SZ;
      const x = cv.getContext('2d'), b = bm.getContext('2d'); let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      x.fillStyle = '#b8bac3'; x.fillRect(0, 0, SZ, SZ); b.fillStyle = '#000'; b.fillRect(0, 0, SZ, SZ);   // joints: snow, low
      const R = 9, cell = SZ / R, rowOff = Array.from({ length: R }, () => rnd() * cell);
      for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
        const off = rowOff[j], cx = i * cell + off + (rnd() - 0.5) * cell * 0.22, cy = j * cell + cell / 2 + (rnd() - 0.5) * cell * 0.18;
        const w = cell * (0.34 + 0.13 * rnd()), hgt = cell * (0.32 + 0.12 * rnd()), rot = (rnd() - 0.5) * 0.8, l = 0.72 + 0.4 * rnd(), tint = rnd();
        for (const dx of [-SZ, 0, SZ]) for (const dy of [-SZ, 0, SZ]) {                                    // (wrap at the tile's edges)
          const px = cx + dx, py = cy + dy; if (px < -cell || px > SZ + cell || py < -cell || py > SZ + cell) continue;
          x.save(); x.translate(px, py); x.rotate(rot);
          const gx = x.createRadialGradient(-w * 0.25, -hgt * 0.3, 2, 0, 0, w * 1.1);
          const r0 = Math.round((tint < 0.5 ? 150 : 132) * l), g0 = Math.round((tint < 0.5 ? 132 : 124) * l), b0 = Math.round((tint < 0.5 ? 120 : 126) * l);
          gx.addColorStop(0, `rgb(${r0 + 22},${g0 + 20},${b0 + 18})`); gx.addColorStop(1, `rgb(${r0 - 18},${g0 - 18},${b0 - 14})`);
          x.fillStyle = gx; x.beginPath(); x.ellipse(0, 0, w, hgt, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(238,240,246,0.55)'; x.beginPath(); x.ellipse(-w * 0.15, -hgt * 0.55, w * 0.55, hgt * 0.22, 0, 0, Math.PI * 2); x.fill();   // a dusting on the top edge
          x.restore();
          b.save(); b.translate(px, py); b.rotate(rot); const gb = b.createRadialGradient(0, 0, 1, 0, 0, w); gb.addColorStop(0, '#fff'); gb.addColorStop(0.7, '#aaa'); gb.addColorStop(1, '#000');
          b.fillStyle = gb; b.beginPath(); b.ellipse(0, 0, w, hgt, 0, 0, Math.PI * 2); b.fill(); b.restore();
        }
      }
      const TILE = 2.3, mk = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((hi.x - lo.x) / TILE, (hi.z - lo.z) / TILE); t.anisotropy = 8; return t; };
      const map = mk(cv); map.colorSpace = THREE.SRGBColorSpace;
      const street = new THREE.Mesh(new THREE.PlaneGeometry(hi.x - lo.x, hi.z - lo.z), new THREE.MeshStandardMaterial({ map, bumpMap: mk(bm), bumpScale: 2.5, roughness: 0.93 }));
      street.rotation.x = -Math.PI / 2; street.position.set((lo.x + hi.x) / 2, 0.022, (lo.z + hi.z) / 2); street.receiveShadow = true; street.name = 'Setts';
      root.add(street); cob.visible = false;
    } }

  // ---------------------------------------------------------------- softer snow
  // The drifts were faceted shards: up close they read as broken paper, and their flat white faces were the brightest
  // thing in the shot. They are welded and smoothed into soft, pillowy drifts, and their steep sides take a cool,
  // slightly deeper tone, so a drift has form and the eye goes to the people instead.
  root.traverse((o) => {
    if (!o.isMesh || !/^(Snow|GroundSnow)$/.test(o.name)) return;
    const P0 = o.geometry.attributes.position, flat = new Float32Array(P0.count * 3);   // (interleaved in the compressed model: copy it out)
    for (let i = 0; i < P0.count; i++) flat.set([P0.getX(i), P0.getY(i), P0.getZ(i)], i * 3);
    const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.BufferAttribute(flat, 3)); if (o.geometry.index) g0.setIndex(o.geometry.index.clone());
    const g = mergeVertices(g0, 1e-4); g.computeVertexNormals();     // welded and smoothed: pillowy drifts, no hard ridges
    const N = g.attributes.normal, col = new Float32Array(N.count * 3);
    const top = new THREE.Color(0xf4f2ee), side = new THREE.Color(0xd3dae6), c = new THREE.Color();
    for (let i = 0; i < N.count; i++) { c.copy(top).lerp(side, smooth((0.95 - N.getY(i)) / 0.7)); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    o.geometry = g; o.material.vertexColors = true; o.material.color.set(0xffffff); o.material.flatShading = false; o.material.needsUpdate = true;   // (the street model flat-shades it)
  });

  // ---------------------------------------------------------------- the toy drop-off box, rebuilt so it can be opened
  // The street model's red box (CrateRed) is one solid block. This one has walls, a dark inside, a carton of toys on its
  // floor and a lid hinged along the back edge, with the slot near the front.
  let boxMat = null;
  root.traverse((o) => { if (o.isMesh && o.name === 'CrateRed') { boxMat = o.material; o.visible = false; } });
  boxMat = boxMat ? boxMat.clone() : new THREE.MeshStandardMaterial({ color: 0xb8302a, roughness: 0.8 });
  // painted planks, not a plastic slab: five boards per face with dark seams, brush streaks and a little wear at the edges
  { const W = 256, cv = document.createElement('canvas'); cv.width = cv.height = W; const x = cv.getContext('2d');
    const bump = document.createElement('canvas'); bump.width = bump.height = W; const bx = bump.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, W);
    for (let k = 0; k < 5; k++) {
      const x0 = k * W / 5, l = 0.92 + 0.12 * rnd();
      x.fillStyle = `rgb(${Math.round(176 * l)},${Math.round(46 * l)},${Math.round(40 * l)})`; x.fillRect(x0, 0, W / 5, W);
      for (let j = 0; j < 26; j++) {                                   // brush strokes along the board
        const sx = x0 + 3 + rnd() * (W / 5 - 6), a = 0.04 + 0.06 * rnd();
        x.strokeStyle = rnd() < 0.5 ? `rgba(255,190,170,${a})` : `rgba(60,10,10,${a})`; x.lineWidth = 1 + rnd() * 2;
        x.beginPath(); x.moveTo(sx, 0); x.bezierCurveTo(sx + rnd() * 4 - 2, W * 0.3, sx + rnd() * 4 - 2, W * 0.7, sx + rnd() * 3 - 1.5, W); x.stroke();
        bx.strokeStyle = `rgba(${rnd() < 0.5 ? 170 : 90},${rnd() < 0.5 ? 170 : 90},128,0.35)`; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(sx, 0); bx.lineTo(sx + 1, W); bx.stroke();
      }
      x.fillStyle = 'rgba(40,8,8,0.55)'; x.fillRect(x0, 0, 2.5, W);   // the seam between two boards
      bx.fillStyle = '#202020'; bx.fillRect(x0, 0, 3, W);
    }
    const g = x.createLinearGradient(0, 0, 0, W); g.addColorStop(0, 'rgba(255,220,200,0.10)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,10,10,0.22)');
    x.fillStyle = g; x.fillRect(0, 0, W, W);                           // a little light wear along the top, grime at the foot
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    boxMat.map = tex; boxMat.bumpMap = new THREE.CanvasTexture(bump); boxMat.bumpScale = 1.2; boxMat.color.set(0xffffff); boxMat.roughness = 0.82; boxMat.needsUpdate = true; }
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1512, roughness: 1 });
  // the street model's cream top and dark slot sat over this box (arms, the truck and the carton went through them):
  // cut them out; the sign's post and board behind stay
  let creamMat = null; root.traverse((o) => { if (o.isMesh && o.name === 'CreamWood' && !creamMat) creamMat = o.material; });
  creamMat = creamMat ? creamMat.clone() : new THREE.MeshStandardMaterial({ color: 0xeee2c8, roughness: 0.8 });
  carve('CreamWood', [BOX.x - BOX.w / 2 - 0.1, BOX.x + BOX.w / 2 + 0.1, 0.55, 0.9, BOX_BACK - 0.08, BOX_FRONT + 0.1]);
  carve('DarkPane', [BOX.x - BOX.w / 2, BOX.x + BOX.w / 2, 0.6, 0.9, BOX_BACK, BOX_FRONT]);
  const slab = (w, h, d, m) => { const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); s.castShadow = true; s.receiveShadow = true; return s; };
  const box = new THREE.Group(); box.position.set(BOX.x, 0, BOX.z); group.add(box);
  const WT = 0.05, Hw = BOX.h - 0.04;
  for (const [w, d, x, z] of [[BOX.w, WT, 0, BOX.d / 2 - WT / 2], [BOX.w, WT, 0, -BOX.d / 2 + WT / 2], [WT, BOX.d, BOX.w / 2 - WT / 2, 0], [WT, BOX.d, -BOX.w / 2 + WT / 2, 0]]) {
    const s = slab(w, Hw, d, boxMat); s.position.set(x, Hw / 2, z); box.add(s);
    const inner = slab(Math.max(0.01, w - 0.012), Hw - 0.02, Math.max(0.01, d - 0.012), darkMat); inner.position.copy(s.position); inner.scale.set(1, 1, 1); inner.renderOrder = -1; box.add(inner);
  }
  const floor = slab(BOX.w - 2 * WT, 0.03, BOX.d - 2 * WT, darkMat); floor.position.y = 0.04; box.add(floor);
  // cream corner posts and a plinth: the box is a made thing, a crate someone built and painted for the season
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = slab(0.07, Hw, 0.07, creamMat); c.position.set(sx * (BOX.w / 2 - 0.025), Hw / 2, sz * (BOX.d / 2 - 0.025)); box.add(c); }
  { const pl = slab(BOX.w + 0.03, 0.07, BOX.d + 0.03, creamMat); pl.position.y = 0.035; box.add(pl); }
  // the top, cream like the street's box: a fixed strip along the back (the sign's post stands on it) and the lid, hinged
  // to that strip, with the slot near its front. Open, the lid stands up and leans back against the sign.
  const LT = 0.07, BACK = 0.13, LD = BOX.d + 0.03 - BACK;                       // lid thickness, back strip depth, lid depth
  { const st = slab(BOX.w + 0.05, LT, BACK + 0.02, creamMat); st.position.set(0, Hw + LT / 2, -BOX.d / 2 + (BACK - 0.02) / 2); box.add(st); }
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, Hw, -BOX.d / 2 + BACK); box.add(lidPivot);
  const slotW = 0.46, slotD = 0.27, slotZ = SLOT.z - (BOX.z - BOX.d / 2 + BACK);   // slot centre, measured from the hinge
  const lidPart = (w, d, x, z) => { const s = slab(w, LT, d, creamMat); s.position.set(x, LT / 2, z); lidPivot.add(s); return s; };
  lidPart(BOX.w + 0.05, slotZ - slotD / 2, 0, (slotZ - slotD / 2) / 2);                         // behind the slot
  lidPart(BOX.w + 0.05, LD - (slotZ + slotD / 2), 0, (slotZ + slotD / 2 + LD) / 2);             // in front of it
  lidPart((BOX.w + 0.05 - slotW) / 2, slotD, -(slotW / 2 + (BOX.w + 0.05 - slotW) / 4), slotZ);   // left of it
  lidPart((BOX.w + 0.05 - slotW) / 2, slotD, (slotW / 2 + (BOX.w + 0.05 - slotW) / 4), slotZ);    // right of it
  { const lip = slab(BOX.w * 0.4, 0.035, 0.04, creamMat); lip.position.set(0, LT * 0.35, LD + 0.02); lidPivot.add(lip); }   // the front lip the hand takes
  const LID_OPEN = Math.PI / 2 + 0.12;                                            // just past upright, held by its hinge stop
  // The drop-off sign stood right behind the hinge, so the opened lid went through its board. Move the sign (post, board,
  // lettering) back so the lid, tipped just past upright, stops a finger's width short of it; a new post reaches the
  // ground, since the old one stood on the box's back strip.
  { const SIGN_BACK = 0.185, reg = (y0) => [BOX.x - 0.55, BOX.x + 0.55, y0, 1.8, BOX_BACK - 0.05, BOX_BACK + 0.2];
    for (const n of ['SignBoard', 'SignLetters', 'CreamWood']) reshape(carve(n, reg(n === 'CreamWood' ? 0.6 : 1.2), true), (v) => { v.z -= SIGN_BACK; });
    const post = slab(0.06, 0.7, 0.06, creamMat); post.position.set(0, 0.35, 0.93 - SIGN_BACK - BOX.z); box.add(post); }   // (the old post's centre was at town z 0.93)
  // The hall's name board ran across both upper windows. Narrow the board and its red edge to the wall between the
  // windows' inner shutters, and scale the lettering to fit (keeping its proportions).
  { const reg = [-3, 3, 3.1, 4.0, -0.1, 0.2], CY = 3.57, HALF = 1.7;
    for (const n of ['SignBoard', 'SignEdge']) reshape(carve(n, reg, true), (v) => { v.x *= HALF / 2.875; });
    reshape(carve('SignLetters', reg, true), (v) => { const k = 0.83; v.x *= k; v.y = CY + (v.y - CY) * k; v.z = 0.06 + (v.z - 0.06) * k; }); }
  // the carton of donated toys, on the box's floor
  box.add(carton); carton.position.set(0, CARTON_BASE, 0); carton.rotation.set(0, 0, 0);
  const cartonHome = () => box.localToWorld(V(0, CARTON_BASE, 0));                 // (town units, via root below)

  // ---------------------------------------------------------------- the hall door, hinged; a warm doorway behind it
  let doorMesh = null; root.traverse((o) => { if (o.isMesh && o.name === 'Door_Hall') doorMesh = o; });
  const doorPivot = new THREE.Group(); doorPivot.position.set(DOOR.hingeX, 0, DOOR.z); root.add(doorPivot);
  if (doorMesh) { const p = doorMesh.position.clone(); doorMesh.parent.remove(doorMesh); doorMesh.position.set(p.x - DOOR.hingeX, p.y, p.z - DOOR.z); doorPivot.add(doorMesh); }
  // the wreath and the handle are part of the town's merged holly, berries, ribbon and brass: cut them out and hang them
  // on the door, so they swing with it (they used to stay hanging in the open doorway)
  for (const [n, reg] of [['Pine', [-0.45, 0.45, 1.1, 2.25, 0.0, 0.4]], ['Berry', [-0.45, 0.45, 1.1, 2.25, 0.0, 0.4]], ['RibbonRed', [-0.45, 0.45, 1.0, 2.25, 0.0, 0.4]],
    ['Holly', [-0.45, 0.45, 1.0, 2.25, 0.0, 0.4]], ['Gold', [-0.7, 0.7, 0.6, 1.5, 0.0, 0.4]], ['Iron', [-0.7, 0.7, 0.5, 1.6, 0.0, 0.3]]]) {
    const piece = carve(n, reg, true); if (piece) doorPivot.attach(piece);
  }
  // the street model backs the doorway with a cream panel (the door was never meant to open): cut it away, keeping the frame
  punch('Hall_wall', -0.06, [-0.68, 0.68, 2.4]);
  punch('CreamWood', -0.08, [-0.68, 0.68, 2.4], 0.14);   // (the door's surround is a solid cream slab: the hole goes through it too)
  // behind the door: the hall's sorting room (Milestone 2B, scene_sorting.js), the whole ground floor of this building,
  // built to its measurements. (It replaces a small entrance room that was only ever seen through the door.)
  const ROOM = { z0: HALL.z0 };
  const roomMat = (color, kind = 'clay', extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
    if (LOOK.felt) LOOK.townScale = S; claySurface(m, kind, false); if (LOOK.felt) LOOK.townScale = null; return m; };
  const roomLight = new THREE.PointLight(0xffb469, 0, 4.6 * S, 2); roomLight.position.set(0, HALL.y1 - 1.2, -1.05); root.add(roomLight);   // (the lamp just inside the door)

  // ---------------------------------------------------------------- lit windows: a warm room behind curtains, not a white card
  // The town's lit windows are one glowing material with no texture coordinates, and at dusk they burned out to flat
  // white rectangles. Each window (its panes, grouped) gets its own coordinates here, and the glow becomes a picture of
  // a lamp-lit room: golden in the middle and low, darker towards the frame, with curtains drawn back at the sides.
  { let win = null; root.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'rt_StoryGlow' && !win) win = o; });
    if (win && win.geometry.index) {
      const g = win.geometry, P = g.attributes.position, I = g.index.array, n = P.count, par = Array.from({ length: n }, (_, i) => i);
      const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
      for (let i = 0; i < I.length; i += 3) { const a = find(I[i]); par[find(I[i + 1])] = a; par[find(I[i + 2])] = a; }
      root.updateMatrixWorld(true);
      const wp = []; for (let i = 0; i < n; i++) wp.push(root.worldToLocal(win.localToWorld(V().fromBufferAttribute(P, i))));
      // panes → windows: panes of one window lie in one plane and nearly touch
      const panes = new Map(); for (let i = 0; i < n; i++) { const r = find(i); if (!panes.has(r)) panes.set(r, []); panes.get(r).push(i); }
      const boxes = [...panes.values()].map((vs) => { const b = new THREE.Box3(); vs.forEach((i) => b.expandByPoint(wp[i])); return { vs, b }; });
      const wins = [];
      for (const pb of boxes) { const w = wins.find((q) => q.b.clone().expandByScalar(0.16).intersectsBox(pb.b)); if (w) { w.b.union(pb.b); w.vs.push(...pb.vs); } else wins.push({ b: pb.b.clone(), vs: [...pb.vs] }); }
      const uv = new Float32Array(n * 2);
      for (const w of wins) { const sz = w.b.getSize(V()), alongX = sz.x >= sz.z;
        for (const i of w.vs) { const p = wp[i]; uv[i * 2] = alongX ? (p.x - w.b.min.x) / Math.max(1e-3, sz.x) : (p.z - w.b.min.z) / Math.max(1e-3, sz.z); uv[i * 2 + 1] = (p.y - w.b.min.y) / Math.max(1e-3, sz.y); } }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const gr = x.createRadialGradient(64, 92, 6, 64, 80, 96); gr.addColorStop(0, '#fff0c8'); gr.addColorStop(0.35, '#f6bf6e'); gr.addColorStop(0.8, '#9c5a2c'); gr.addColorStop(1, '#5e3418');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      // curtains drawn back at both sides, with folds and a tie-back (the left one mirrored)
      for (const side of [0, 1]) { x.save(); if (side) { x.translate(128, 0); x.scale(-1, 1); }
        x.beginPath(); x.moveTo(0, 0); x.lineTo(30, 0); x.quadraticCurveTo(16, 50, 22, 70); x.quadraticCurveTo(30, 100, 26, 128); x.lineTo(0, 128); x.closePath();
        x.fillStyle = '#5c1c16'; x.fill();
        x.strokeStyle = 'rgba(40,10,6,0.45)'; x.lineWidth = 2; for (const fx of [7, 14, 21]) { x.beginPath(); x.moveTo(fx, 0); x.quadraticCurveTo(fx * 0.6, 60, fx * 0.9, 128); x.stroke(); }
        x.fillStyle = '#d9a93f'; x.fillRect(4, 66, 20, 4); x.restore(); }
      // a valance along the top, and the sill's shadow
      x.fillStyle = '#6a2018'; x.fillRect(0, 0, 128, 10); x.fillStyle = 'rgba(30,12,4,0.35)'; x.fillRect(0, 118, 128, 10);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      win.material.emissiveMap = tex; win.material.emissive.setRGB(1, 0.86, 0.66); win.material.userData.base = 1.7; win.material.needsUpdate = true;
    } }
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 40, 4, 64, 54, 70);
    gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.5, 'rgba(255,170,90,0.45)'); gr.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.06, 1.15); pool.visible = false; root.add(pool);
  const spill = new THREE.PointLight(0xffc37a, 0, 6 * S, 2); spill.position.set(0, 1.25, 0.55); root.add(spill);
  const doorAngle = (t) => {
    if (t < T.door0) return 0;
    if (t < T.door1) return 1.66 * backOut((t - T.door0) / (T.door1 - T.door0));
    if (t < T.shut0) return 1.66;
    if (t > T.shut1) return 0;
    const k = (t - T.shut0) / (T.shut1 - T.shut0); return k < 0.85 ? 1.66 * (1 - smooth(k / 0.85)) : 0.035 * Math.sin(Math.PI * (k - 0.85) / 0.15);
  };
  const handleAt = (th) => { const lx = DOOR.w - 0.17, lz = 0.1; return V(DOOR.hingeX + lx * Math.cos(th) - lz * Math.sin(th), 1.02, DOOR.z + lx * Math.sin(th) + lz * Math.cos(th)); };
  const doorStand = (th) => { const h = handleAt(th), n = V(-Math.sin(th), 0, Math.cos(th)); return V(h.x, 0, h.z).addScaledVector(n, 0.42).add(V(0.12 * Math.cos(th), 0, 0)); };

  // ---------------------------------------------------------------- the glow of the box when a toy goes in, and a few sparks
  // The glow comes from inside: the light sits under the lid (it was above it and burned the lid's cream top to white),
  // so it warms the child's face, the hands and the snow around, and the slot itself shines softly.
  const glow = new THREE.PointLight(0xffb066, 0, 3.0 * S, 2); glow.position.copy(SLOT).add(V(0, -0.1, 0)); group.add(glow);
  const slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.55, 0.22).multiplyScalar(0.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  slotGlow.rotation.x = -Math.PI / 2; slotGlow.position.copy(SLOT).add(V(0, -0.035, 0)); group.add(slotGlow);
  const NSP = 14, spark = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.018), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc458).multiplyScalar(1.6), transparent: true, depthWrite: false }), NSP);
  spark.frustumCulled = false; group.add(spark);
  const seeds = Array.from({ length: NSP }, (_, i) => [Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1), Math.abs(Math.sin(i * 78.233) * 12543.123 % 1), (i * 0.618) % 1]);

  // ---------------------------------------------------------------- town life: chimney smoke (found from the chimneys' bricks)
  const chimneys = [];
  { const cells = new Map(); const v = V();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || o.name !== 'Brick') return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); o.localToWorld(v); root.worldToLocal(v);
        if (v.y < 3.4) continue;
        const k = Math.round(v.x / 1.5) + ',' + Math.round(v.z / 1.5), c = cells.get(k) || { n: 0, x: 0, z: 0, top: 0 };
        c.n++; c.x += v.x; c.z += v.z; c.top = Math.max(c.top, v.y); cells.set(k, c);
      }
    });
    for (const c of cells.values()) if (c.n > 6) {
      const p = V(c.x / c.n, c.top + 0.08, c.z / c.n), near = chimneys.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1.1);
      if (near) { near.x = (near.x + p.x) / 2; near.z = (near.z + p.z) / 2; near.y = Math.max(near.y, p.y); } else chimneys.push(p);
    }
  }
  const PUFFS = tier === 'low' ? 5 : 8;
  const puffMat = new THREE.MeshStandardMaterial({ color: 0xd8d2ca, roughness: 1, transparent: true, opacity: 0.88, depthWrite: false });
  const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), puffMat, Math.max(1, chimneys.length * PUFFS));
  smoke.frustumCulled = false; smoke.castShadow = false; group.add(smoke);
  // snow tossed by the shoveller: a few small felt clumps
  const clumps = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xf4f6fb, roughness: 1 }), 6);
  clumps.frustumCulled = false; group.add(clumps);
  // the shovel: a turned wooden handle, a red felt blade
  const shovel = new THREE.Group(); group.add(shovel);
  { const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8 }), blade = new THREE.MeshStandardMaterial({ color: 0xb33a2c, roughness: 0.9 });
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 1.15, 8), wood); h.position.y = 0.575; shovel.add(h);
    const grip = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 12), wood); grip.position.y = 1.17; grip.rotation.y = Math.PI / 2; shovel.add(grip);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.3), blade); b.position.set(0, 0.0, 0.13); b.rotation.x = 0.25; shovel.add(b);
    shovel.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }

  // ---------------------------------------------------------------- contact shadows: what sets a puppet down on the set
  // At night the moon's shadow is faint and the lamps cast none, so the puppets read as floating. Each gets a soft shadow
  // under the body and one under each foot, darkest when the foot is planted and fading as it lifts.
  // a soft disc: rings of a fan whose vertex alpha falls from the centre to the rim (no texture, no custom shader)
  const blobGeo = (() => {
    const R = [[0, 1], [0.16, 0.85], [0.3, 0.55], [0.42, 0.22], [0.5, 0]], N = 28, pos = [], col = [], idx = [];
    R.forEach(([r, a], ri) => { for (let i = 0; i < (ri ? N : 1); i++) { const t = i / N * Math.PI * 2; pos.push(r * Math.cos(t), 0, r * Math.sin(t)); col.push(1, 1, 1, a); } });
    for (let i = 0; i < N; i++) idx.push(0, 1 + (i + 1) % N, 1 + i);
    for (let ri = 1; ri < R.length - 1; ri++) { const o = 1 + (ri - 1) * N, o2 = o + N;
      for (let i = 0; i < N; i++) { const j = (i + 1) % N; idx.push(o + i, o + j, o2 + i, o + j, o2 + j, o2 + i); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); return g;
  })();
  const contact = (M, clip) => {
    const mk = () => { const m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x1a1020, vertexColors: true, transparent: true, depthWrite: false, opacity: 0,
      // multiplied into the ground's light (the snow is brighter than white before tone mapping: a dark overlay barely shows)
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      clippingPlanes: clip ? [clipPlane] : null })); m.renderOrder = 2; group.add(m); return m; };
    M.blobs = { body: mk(), L: mk(), R: mk() };
  };
  function setContact(M) {
    const k = M.scale, b = M.blobs, vis = M.obj.visible && !window.__noContact;   // (__noContact: a test hook)
    const o = L(M.obj.getWorldPosition(V()));
    const gy = footing(o.x, o.z);
    b.body.visible = vis; b.body.position.set(o.x, gy + 0.02, o.z); b.body.scale.set(0.95 * k, 1, 0.8 * k); b.body.rotation.y = M.obj.rotation.y; b.body.material.opacity = 0.82;
    for (const side of ['L', 'R']) {
      const f = L(M.bones['foot' + side].getWorldPosition(V())), g = ground(f.x, f.z), lift = clamp((f.y - g - 0.1 * k) / (0.16 * k));
      const m = b[side]; m.visible = vis; m.position.set(f.x, g + 0.022, f.z + 0.02 * k); m.scale.set((0.26 + 0.1 * lift) * k, 1, (0.38 + 0.1 * lift) * k);
      m.rotation.y = M.obj.rotation.y; m.material.opacity = 0.9 * (1 - lift);
    }
  }
  const CAST = [marine, parent, child, volunteer, passer, passer2, passerKid, shoveller];
  CAST.forEach((M) => contact(M, M === marine || M === volunteer));

  // ---------------------------------------------------------------- posing helpers
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  function pose(M, p, yaw, W, w, extra = {}) {
    // every bone back to the clips' pose of the last update first: the mixer only rewrites a bone when its clip value
    // changes, and the reaches and bends of the last frame must not leak into this one (a pose is a pure function of time)
    for (const [b, q, ps] of (M.snap || M.rest)) { b.quaternion.copy(q); b.position.copy(ps); }
    M.obj.position.set(p.x, Number.isFinite(p.gy) ? p.gy : footing(p.x, p.z), p.z); M.obj.rotation.set(0, yaw, 0);
    for (const [k, a] of Object.entries(M.acts)) {
      const wt = W[k] || 0; a.setEffectiveWeight(wt);
      const d = a.getClip().duration;
      a.time = k.startsWith('Walk') ? (((extra.phase || 0) % 1 + 1) % 1) * d : k === 'Give' ? clamp(extra.give || 0, 0, d - 1e-3) : ((w + (extra.off || 0)) % d + d) % d;
    }
    M.mixer.update(0);
    if (!M.snap) M.snap = M.rest.map(([b]) => [b, new THREE.Quaternion(), new THREE.Vector3()]);
    for (const e of M.snap) { e[1].copy(e[0].quaternion); e[2].copy(e[0].position); }
    M.obj.updateMatrixWorld(true);
  }
  const walkW = (s) => smooth(s.speed / 0.45);
  function walker(path, L, v, t0, t, endYaw, stride, startYaw = null) {
    const tr = travel(t, t0, L, v), u = clamp(tr.s / L);
    const p = path.getPointAt(u);
    // the ground under the feet, averaged a little along the way: a step (the hall's doorstep) is climbed, not popped onto
    const gAt = (s2) => { const q = path.getPointAt(clamp(s2 / L)); return footing(q.x, q.z); };
    // (cobbles: a wide window, so a puppet walks on the street's average surface rather than hopping stone to stone)
    p.gy = (gAt(tr.s - 0.45) + 2 * gAt(tr.s - 0.22) + 3 * gAt(tr.s) + 2 * gAt(tr.s + 0.22) + gAt(tr.s + 0.45)) / 9;
    let yaw = yawOf(path.getTangentAt(Math.min(u, 0.999)));
    if (startYaw !== null) yaw = angLerp(startYaw, yaw, ramp(t, t0, t0 + 0.6));   // turn into the walk from where they stood
    if (u > 0.8) yaw = angLerp(yaw, endYaw, ramp(u, 0.8, 1));
    return { p, yaw, speed: tr.v, phase: tr.s / stride, done: u >= 1 };
  }
  // rotate a bone by a world-space rotation (keeps the rest of the pose)
  function turnBone(bone, axis, ang) {
    if (Math.abs(ang) < 1e-5) return;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(bone.getWorldQuaternion(_q));
    bone.parent.getWorldQuaternion(_q2).invert(); bone.quaternion.copy(_q2.multiply(q)); bone.updateMatrixWorld(true);
  }
  const axes = (M) => { const q = M.obj.getWorldQuaternion(new THREE.Quaternion()); return { q, fwd: V(0, 0, 1).applyQuaternion(q), right: V(1, 0, 0).applyQuaternion(q), up: V(0, 1, 0) }; };
  // bend forward from the waist (spine and chest share it), a hand's-width of weight shift with it
  function bend(M, ang) { if (Math.abs(ang) < 1e-4) return; const { right } = axes(M); turnBone(M.bones.spine, right, ang * 0.55); turnBone(M.bones.chest, right, ang * 0.45); }
  // turn the head (and a little of the neck) towards a world point
  function lookAt(M, target, w, { maxYaw = 1.05, maxPitch = 0.55 } = {}) {
    if (w <= 1e-3 || !target) return;
    const head = M.bones.head, { q, right } = axes(M);
    const d = target.clone().sub(head.getWorldPosition(V())).applyQuaternion(q.clone().invert());
    const yaw = clamp(Math.atan2(d.x, d.z), -maxYaw, maxYaw) * w, pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -maxPitch, maxPitch) * w;
    turnBone(M.bones.neck, V(0, 1, 0), yaw * 0.35); turnBone(head, V(0, 1, 0), yaw * 0.65);
    turnBone(M.bones.neck, right, -pitch * 0.35); turnBone(head, right, -pitch * 0.65);
  }
  // two-bone arm reach towards a world point, the elbow bending towards `pole`; w blends from the clip's pose
  function aimBone(bone, cur, want, w) {
    const q = new THREE.Quaternion().setFromUnitVectors(cur, want).multiply(bone.getWorldQuaternion(_q));
    bone.parent.getWorldQuaternion(_q2).invert(); const local = _q2.multiply(q);
    bone.quaternion.slerp(local, w); bone.updateMatrixWorld(true);
  }
  function reach(M, side, target, w, pole) {
    if (w <= 1e-3 || !target) return;
    const up = M.bones['upper_arm' + side], fo = M.bones['forearm' + side], ha = M.bones['hand' + side];
    const A = up.getWorldPosition(V()), B = fo.getWorldPosition(V()), C = ha.getWorldPosition(V());
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const dv = target.clone().sub(A); const d = clamp(dv.length(), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4); const dir = dv.normalize();
    const pv = pole.clone().sub(A); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.lengthSq() < 1e-10) pv.set(0, -1, 0); pv.normalize();
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const E = A.clone().addScaledVector(dir, l1 * Math.cos(a)).addScaledVector(pv, l1 * Math.sin(a)), Tt = A.clone().addScaledVector(dir, d);
    aimBone(up, B.clone().sub(A).normalize(), E.clone().sub(A).normalize(), w);
    const B2 = fo.getWorldPosition(V()), C2 = ha.getWorldPosition(V());
    aimBone(fo, C2.sub(B2).normalize(), Tt.sub(B2).normalize(), w);
  }
  // an elbow pole a little behind, below and outside a character's shoulder
  const elbowPole = (M, side, out = 0.35) => { const { fwd, right } = axes(M); const sh = M.bones['upper_arm' + side].getWorldPosition(V()); const k = M.scale * S;
    return sh.addScaledVector(fwd, -0.5 * k).addScaledVector(V(0, 1, 0), -0.9 * k).addScaledVector(right, (side === 'L' ? 1 : -1) * out * k); };
  const W = (v) => root.localToWorld(v.clone());           // town units → world
  const L = (v) => root.worldToLocal(v.clone());           // world → town units
  const handMid = (M) => M.bones.handL.getWorldPosition(V()).add(M.bones.handR.getWorldPosition(V())).multiplyScalar(0.5);

  // ---------------------------------------------------------------- paths
  // the family walks the clear sidewalk: the child on the house side (past the bench's front), the parent on the street
  // side along the edge of the drifts (the old line ran over the drifts and the curb stones)
  const C_PATH = curve([[-4.6, 2.02], [-2.4, 2.0], [-0.4, 1.84], [1.6, 1.84], [2.5, 1.88]]), LC = C_PATH.getLength();
  const P_PATH = curve([[-5.3, 2.32], [-2.6, 2.3], [0.6, 2.22], [2.5, 2.4], [3.3, 2.62]]), LP = P_PATH.getLength();   // (ends behind the child's right shoulder, out of the donation close-up's way)
  const vC = 1.12, P_LAG = 0.75, vP = LP / (LC / vC - P_LAG + 0.3);   // the child leads, eager; the parent sets off a beat later and catches up at the box
  const A_C = curve([[2.5, 1.88], [2.85, 2.1], [3.05, 2.42]]), LAC = A_C.getLength();      // stepping back from the box, to watch      // stepping aside afterwards, beside the box
  const A_P = curve([[3.3, 2.62], [3.5, 2.45], [3.6, 2.25]]), LAP = A_P.getLength();
  // the Marine waits beside the wagon (clear of the bench's end: he used to stand inside it, and so on top of it)
  const M_START = V(-1.72, 0, 1.46), M_STAND = V(2.3, 0, 2.0);
  const M_PATH = curve([[M_START.x, M_START.z], [-0.8, 1.85], [0.6, 2.05], [1.65, 2.1], [M_STAND.x, M_STAND.z]]), LM = M_PATH.getLength(), vM = 1.25;
  const M_IN = curve([[M_STAND.x, M_STAND.z], [1.55, 1.75], [0.62, 1.02], [0.1, 0.42], [0.0, -0.2], [0.0, -0.9]]), LMI = M_IN.getLength(), vMI = 1.05;
  const V_DOOR = doorStand(0), V_OUT = doorStand(1.66);
  const V_PATH = curve([[VOL.x, VOL.z], [1.05, 0.78], [V_DOOR.x, V_DOOR.z]]), LV = V_PATH.getLength();
  const V_AFTER = curve([[V_DOOR.x, V_DOOR.z], [1.05, 0.82], [1.4, 0.95]]), LVA = V_AFTER.getLength();
  const tFamilyArrive = T.walk0 + walkTime(LC, vC);
  // beat 2's moments, from the Marine's walk to the box and to the hall
  { const arr = T.mWalk0 + walkTime(LM, vM);
    T.reach0 = arr + 0.2; T.lid0 = T.reach0 + 0.6; T.lid1 = T.lid0 + 0.8; T.lidGo = T.lid1 + 0.05;
    T.in0 = T.lidGo + 0.25; T.grip = T.in0 + 0.6; T.lift2 = T.grip + 1.5; T.carry0 = T.lift2 + 0.45; T.go0 = T.carry0 + 0.15;
    T.v0 = arr - 0.3; T.door0 = T.grip - 0.2; T.door1 = T.door0 + 1.5;
    // inside once the Marine has walked past the doorway (path length to z < -0.45)
    let sIn = LMI; for (let i = 0; i <= 200; i++) { if (M_IN.getPointAt(i / 200).z < -0.45) { sIn = LMI * i / 200; break; } }
    T.inside = T.go0 + sIn / vMI + 0.6; T.shut0 = T.inside + 0.15; T.shut1 = T.shut0 + 1.15; T.end = T.shut1 + 1.1;
    BEATS.collection[1] = +T.end.toFixed(2); }
  const YAW_BOX = Math.PI;                                         // facing the box (towards the hall)
  const sorting = createSorting({ V, clamp, smooth, ramp, lerp, angLerp, yawOf, curve, travel, root, group, S, makeChar, gp, gv, roomMat, slab, contact, setContact,
    pose, walker, walkW, bend, lookAt, reach, turnBone, axes, elbowPole, W, L, marine, carton, truck, T, BEATS, groundMeshes, punch });

  // ---------------------------------------------------------------- one moment of the scene
  const state = {};
  function evaluate(t, w) {
    const tc = Math.floor(t * 12) / 12, wc = Math.floor(w * 12) / 12;     // puppets move on twos
    root.updateMatrixWorld(true);
    // the doorway cut, in world space (z of the wall's face)
    // (now at the entrance room's back wall: whoever walks in is seen inside the room, and never pokes through its wall)
    const face = W(V(0, 0, ROOM.z0 + 0.03)); clipPlane.normal.set(0, 0, 1); clipPlane.constant = -face.z;

    // ---- the family
    let c = walker(C_PATH, LC, vC, T.walk0, tc, YAW_BOX, child.stride);
    let p = walker(P_PATH, LP, vP, T.walk0 + P_LAG, tc, yawOf(V(-0.85, 0, -0.5)), parent.stride);
    if (tc > T.aside0) {                                                  // stepping aside, then turning to watch
      const a = walker(A_C, LAC, 0.75, T.aside0, tc, yawOf(V(-0.87, 0, -0.5)), child.stride, YAW_BOX);
      const b = walker(A_P, LAP, 0.75, T.aside0 + 0.2, tc, yawOf(V(-1, 0, -0.25)), parent.stride, yawOf(V(-0.85, 0, -0.5)));
      c = a; p = b;
    }
    const carryT = 1 - ramp(tc, T.drop1 - 0.05, T.drop1 + 0.3);           // holding the truck until it is let go
    const cw = walkW(c);
    pose(child, c.p, c.yaw, { WalkCarry: cw * carryT, Walk: cw * (1 - carryT), IdleCarry: (1 - cw) * carryT, Idle: (1 - cw) * (1 - carryT) }, wc, { phase: c.phase, off: 0.6 });
    const pw = walkW(p);
    pose(parent, p.p, p.yaw, { Walk: pw, Idle: (1 - pw) }, wc, { phase: p.phase, off: 1.3 });
    // the truck: in the child's arms, lifted over the box, lowered into the slot, let go; it lands on the toys inside
    // carried steadily in front of the chest (the clip's arm swing made the truck sway 0.12 a stride); the body's bob
    // still carries it, and the hands are put on its two ends below
    const held = (() => {                                                 // (town units, like the state trace)
      const wp = child.obj.getWorldPosition(V()), cp = L(wp), f = L(wp.clone().add(axes(child).fwd)).sub(cp).setY(0).normalize();
      return W(cp.addScaledVector(f, 0.09).add(V(0, 0.6, 0)));
    })();
    const over = W(V(SLOT.x, SLOT.y + 0.24, SLOT.z)), inSlot = W(V(SLOT.x, SLOT.y - 0.06, SLOT.z));
    const restOn = () => carton.localToWorld(V(0.02, 0.33, -0.01));       // on top of the toys in the carton
    let tp, ty = c.yaw + Math.PI / 2;
    if (tc < T.lift0) tp = held;
    else if (tc < T.lift1) { const k = smooth((tc - T.lift0) / (T.lift1 - T.lift0)); tp = held.clone().lerp(over, k); tp.y += Math.sin(Math.PI * k) * 0.05 * S; ty = angLerp(ty, 0, k); }
    else if (tc < T.show1) { tp = over.clone(); tp.y += Math.sin((tc - T.lift1) * 6) * 0.006 * S; ty = 0; }
    else if (tc < T.lower1) { tp = over.clone().lerp(inSlot, smooth((tc - T.show1) / (T.lower1 - T.show1))); ty = 0; }
    else if (tc < T.drop1) { tp = inSlot.clone(); ty = 0; }
    else {
      const k = clamp((tc - T.drop1) / 0.32), dest = restOn();
      tp = k < 1 ? inSlot.clone().lerp(dest, k * k) : dest; ty = 0.25 * smooth(k);
    }
    const riding = tc >= T.drop1 + 0.32;          // from here the truck rides on the carton (placed after the carton below)
    if (!riding) { truck.position.copy(L(tp)); truck.rotation.set(0, ty, 0); }
    // the child's hands follow the truck while it is lifted and lowered, then come back
    const handsOn = 1 - ramp(tc, T.drop1, T.drop1 + 0.45);
    if (handsOn > 0) {
      bend(child, 0.12 * handsOn * ramp(tc, T.lift0 - 0.15, T.lift0 + 0.2));
      const side = V(Math.cos(ty), 0, -Math.sin(ty)).multiplyScalar(0.15 * S);    // the truck's two ends
      const tw = truck.getWorldPosition(V()).add(V(0, 0.08 * S, 0));
      const lr = side.dot(axes(child).right) > 0 ? 1 : -1;                          // left hand at the end on the child's left
      reach(child, 'L', tw.clone().addScaledVector(side, lr), handsOn, elbowPole(child, 'L'));
      reach(child, 'R', tw.clone().addScaledVector(side, -lr), handsOn, elbowPole(child, 'R'));
    }
    // eye lines: the child watches the box and the truck, then looks up at the parent; the parent watches the child
    const childHead = child.bones.head.getWorldPosition(V()), parentHead = parent.bones.head.getWorldPosition(V());
    const marineHead = () => marine.bones.head.getWorldPosition(V());
    if (tc < T.up0) lookAt(child, tc > tFamilyArrive - 1.2 ? truck.getWorldPosition(V()) : W(V(BOX.x, 0.6, BOX.z)), ramp(tc, tFamilyArrive - 1.6, tFamilyArrive - 0.6));
    else if (tc < T.aside0 + 0.4) lookAt(child, parentHead, ramp(tc, T.up0, T.up1));
    lookAt(parent, childHead, ramp(tc, tFamilyArrive - 0.4, tFamilyArrive + 0.4) * (1 - ramp(tc, T.aside0 + 2.2, T.aside0 + 3)));
    if (tc > T.up0 && tc < T.aside0 + 0.6) { const nodK = ramp(tc, T.up1, T.up1 + 0.25) * (1 - ramp(tc, T.up1 + 0.5, T.up1 + 0.8)); turnBone(parent.bones.head, axes(parent).right, 0.28 * nodK); }
    if (tc > T.m0) { lookAt(child, marineHead(), ramp(tc, T.m0 + 1.2, T.m0 + 2.2)); lookAt(parent, marineHead(), ramp(tc, T.m0 + 1.6, T.m0 + 2.6)); }

    // ---- the volunteer: waves the family over, watches the gift, waves and nods; then goes to the door and opens it
    const vWave1 = ramp(tc, 1.9, 2.4) * (1 - ramp(tc, 4.4, 4.9)), vWave2 = ramp(tc, T.wave0, T.wave0 + 0.4) * (1 - ramp(tc, T.wave1 - 0.3, T.wave1));
    const wv = Math.max(vWave1, vWave2);
    const th = doorAngle(tc), handle = W(handleAt(th));
    let vp = VOL.clone(), vy = angLerp(yawOf(V(-1, 0, 0.75)), yawOf(V(2.5 - VOL.x, 0, 2.1 - VOL.z)), ramp(tc, 4.6, 5.8)), vw = 0, vph = 0;
    if (tc > T.v0) { const m = walker(V_PATH, LV, 0.8, T.v0, tc, Math.PI, volunteer.stride); vp = m.p; vy = m.yaw; vw = walkW(m); vph = m.phase; }
    if (tc > T.door0) {                     // pulling the door open: stepping back along its swing, the hand on the handle
      vp = doorStand(th); vy = yawOf(V(Math.sin(th), 0, -Math.cos(th)));
      vw = (tc < T.door1) ? 0.6 * Math.sin(Math.PI * clamp((tc - T.door0) / (T.door1 - T.door0))) : 0; vph = -(tc - T.door0) * 1.1;
    }
    if (tc > T.shut0 && tc < T.shut1) { vw = 0.55 * Math.sin(Math.PI * clamp((tc - T.shut0) / (T.shut1 - T.shut0))); vph = (tc - T.shut0) * 1.1; }
    if (tc >= T.shut1) { const m = walker(V_AFTER, LVA, 0.7, T.shut1 + 0.15, tc, yawOf(V(0.3, 0, 1)), volunteer.stride, Math.PI); vp = m.p; vy = m.yaw; vw = walkW(m); vph = m.phase; }
    pose(volunteer, vp, vy, { Wave: wv * (1 - vw), Walk: vw, Idle: (1 - wv) * (1 - vw) }, wc, { off: 0.3, phase: vph });

    if (tc < T.v0) lookAt(volunteer, tc < 6 ? childHead : truck.getWorldPosition(V()), 0.85);
    if (tc > T.wave0 && tc < T.wave1 + 0.3) { const k = ramp(tc, T.wave1 - 0.35, T.wave1 - 0.1) * (1 - ramp(tc, T.wave1 + 0.05, T.wave1 + 0.3)); turnBone(volunteer.bones.head, axes(volunteer).right, 0.3 * k); }
    const vHand = ramp(tc, T.door0 - 0.45, T.door0) * (1 - ramp(tc, T.shut1 - 0.1, T.shut1 + 0.35));
    reach(volunteer, 'R', handle, vHand, elbowPole(volunteer, 'R'));
    if (tc > T.door0 && tc < T.shut0) lookAt(volunteer, tc < T.door1 ? handle : marineHead(), 0.8);
    else if (tc >= T.shut0) lookAt(volunteer, tc < T.shut1 ? handle : W(V(BOX.x, 0.9, BOX.z + 1)), 0.7);

    // ---- the Marine: by the wagon; to the box; lid up; carton out; to the hall; in
    let mp = M_START.clone(), my = yawOf(V(WAGON[0] - M_START.x, 0, WAGON[1] - M_START.z)), mw = 0, mph = 0, carryW = 0;
    let lid = 0, bendM = 0;
    // tidying the wagon while beat 1 plays (a hand on the toys, now and then)
    const tidy = ramp((w % 7.0), 1.2, 1.6) * (1 - ramp((w % 7.0), 2.8, 3.2));
    if (tc > T.mWalk0) { const m = walker(M_PATH, LM, vM, T.mWalk0, tc, YAW_BOX, marine.stride, my); mp = m.p; my = m.yaw; mw = walkW(m); mph = m.phase; }
    // the lid: taken at its front lip, lifted to the vertical, let go; it falls open against its stay and rests
    // (let go short of upright, it tips over under its own weight and bounces once, softly, on its hinge stop)
    if (tc > T.lid0) { const u = tc - T.lidGo, kf = clamp(u / 0.28);
      lid = tc < T.lid1 ? 1.2 * smooth((tc - T.lid0) / (T.lid1 - T.lid0)) : tc < T.lidGo ? 1.2
        : u < 0.28 ? 1.2 + (LID_OPEN - 1.2) * kf * kf : LID_OPEN - 0.07 * Math.exp(-6 * (u - 0.28)) * Math.abs(Math.sin(11 * (u - 0.28))); }
    lidPivot.rotation.x = -lid;
    const lip = () => lidPivot.localToWorld(V(0, LT * 0.35, LD + 0.03));
    // the carton: in the box, gripped, lifted clear of the walls, brought to the chest, then carried
    const cHome = box.localToWorld(V(0, CARTON_BASE, 0));
    const bendIn = ramp(tc, T.reach0, T.lid0) * (1 - ramp(tc, T.lid1 - 0.2, T.lid1 + 0.1));
    const bendDeep = ramp(tc, T.in0, T.grip) * (1 - ramp(tc, T.grip + 0.3, T.lift2));
    bendM = 0.42 * bendIn + 0.62 * bendDeep;
    if (tc > T.go0) { const m = walker(M_IN, LMI, vMI, T.go0, tc, Math.PI, marine.stride, YAW_BOX); mp = m.p; my = m.yaw; mw = walkW(m); mph = m.phase; }
    carryW = ramp(tc, T.lift2 - 0.1, T.carry0) * 0.6;   // the carry clip's arms only as a base: the hands are placed on the carton
    pose(marine, mp, my, { WalkCarry: mw * carryW, Walk: mw * (1 - carryW), IdleCarry: (1 - mw) * carryW, Idle: (1 - mw) * (1 - carryW) }, wc, { phase: mph });
    bend(marine, bendM + 0.06 * carryW * (1 - mw));        // a little lean back against the weight once it is up
    // where the carton sits in the carry pose (between the hands, a little forward)
    // where the carton rides: in front of the chest at a steady height, bobbing a little with the steps (the hands hold its
    // sides, so it never follows the clips' hand positions)
    const carrySpot = () => { const { fwd } = axes(marine), bob = mw * 0.018 * Math.sin(mph * Math.PI * 4); return marine.obj.getWorldPosition(V()).addScaledVector(fwd, 0.32 * S).add(V(0, (0.77 + bob) * S, 0)); };
    if (tc < T.grip) { if (carton.parent !== box) box.attach(carton); carton.position.set(0, CARTON_BASE, 0); carton.rotation.set(0, 0, 0); carton.updateMatrixWorld(true); }
    else {
      if (carton.parent !== group) group.attach(carton);
      const startW = cHome, upW = cHome.clone().add(V(0, (BOX.h + 0.06) * S, 0));
      // up out of the box (straight, so it clears the walls), then into the arms
      // (weight: a beat of effort as the grip takes the load, then a steady rise; ~1 unit/s at its fastest)
      const kl = clamp((tc - T.grip - 0.12) / ((T.lift2 - T.grip) * 0.82)), k1 = kl * kl * (3 - 2 * kl);
      const k2 = smooth(clamp((tc - T.grip - (T.lift2 - T.grip) * 0.72) / ((T.lift2 - T.grip) * 0.28 + (T.carry0 - T.lift2))));
      let cw2 = startW.clone().lerp(upW, k1);
      if (k2 > 0) cw2 = cw2.lerp(carrySpot().add(V(0, -0.17 * S, 0)), k2);   // (carton origin: its base)
      carton.position.copy(L(cw2)); carton.rotation.set(0, lerp(0, my - YAW_BOX, k2), 0);
      carton.updateMatrixWorld(true);
    }
    if (riding) { const rw = restOn(); truck.position.copy(L(rw)); truck.quaternion.copy(carton.getWorldQuaternion(new THREE.Quaternion())); truck.rotateY(0.25); }
    // hands: on the lid's lip while lifting it; on the carton's sides while lifting it out (the carry clip takes over after)
    const onLid = ramp(tc, T.reach0 + 0.1, T.lid0) * (1 - ramp(tc, T.lid1 - 0.1, T.lidGo + 0.05));
    const onCarton = ramp(tc, T.in0 + 0.1, T.grip);   // from the grip on, the hands stay on the carton's sides
    if (onLid > 0) { const l = lip(), sd = V(0.32 * S, 0, 0); reach(marine, 'L', l.clone().add(sd), onLid, elbowPole(marine, 'L')); reach(marine, 'R', l.clone().sub(sd), onLid, elbowPole(marine, 'R')); }
    if (onCarton > 0) { const cc = carton.localToWorld(V(0, 0.2, 0)), sd = V(0.27 * S, 0, 0).applyAxisAngle(V(0, 1, 0), my - YAW_BOX);
      reach(marine, 'L', cc.clone().add(sd), onCarton, elbowPole(marine, 'L', 0.6)); reach(marine, 'R', cc.clone().sub(sd), onCarton, elbowPole(marine, 'R', 0.6)); }
    if (tc < T.mWalk0 && tidy > 0) reach(marine, 'R', W(V(WAGON[0] - 0.1, 0.72, WAGON[1] + 0.1)), 0.8 * tidy, elbowPole(marine, 'R'));
    // eye lines
    if (tc < T.m0) lookAt(marine, W(V(WAGON[0], 0.5, WAGON[1])), 0.7);
    else if (tc < T.reach0) lookAt(marine, tc < T.mWalk0 + 0.6 ? W(V(BOX.x, 0.8, BOX.z)) : W(V(BOX.x, 0.5, BOX.z)), ramp(tc, T.m0, T.m0 + 0.5));
    else if (tc < T.go0) lookAt(marine, tc < T.in0 ? lip() : carton.localToWorld(V(0, 0.3, 0)), 0.9);
    else lookAt(marine, W(V(0, 1.3, 0)), 0.6);
    // inside, they stay in view in the lit room until the door is shut on them
    marine.obj.visible = !(tc > T.shut1 && L(marine.obj.getWorldPosition(V())).z < 0);
    carton.visible = !(tc > T.shut1 && L(carton.getWorldPosition(V())).z < 0);
    truck.visible = carton.visible || tc < T.go0;

    // ---- the door, the doorway, the light
    doorPivot.rotation.y = -th;
    const open = clamp(th / 1.2);
    pool.visible = open > 0.01; pool.material.opacity = 0.32 * open;
    roomLight.intensity = 7 * S * S * clamp(th / 0.6); spill.intensity = 3.5 * S * S * open;   // (the room's lamp does the lighting; the spill only warms the step)

    // ---- the box's glow and the sparks as the truck goes in
    const gk = ramp(tc, T.drop1, T.drop1 + 0.3) * (1 - ramp(tc, T.drop1 + 1.3, T.drop1 + 3.4));
    glow.intensity = 3.5 * S * S * gk; slotGlow.material.opacity = 0.45 * gk; slotGlow.visible = gk > 0.001;
    const sp = clamp((tc - T.drop1) / 2.0), mtx = new THREE.Matrix4();
    for (let i = 0; i < NSP; i++) {
      const [a, b, e] = seeds[i], s = sp > 0 && sp < 1 ? (1 - sp) * (0.6 + 0.6 * e) : 0;
      const r = 0.08 + 0.22 * sp * a, ang = i * 2.4 + sp * 2;
      mtx.compose(V(SLOT.x + Math.cos(ang) * r, SLOT.y + 0.06 + sp * (0.45 + 0.6 * b), SLOT.z + Math.sin(ang) * r * 0.6), new THREE.Quaternion(), V(s, s, s));
      spark.setMatrixAt(i, mtx);
    }
    spark.instanceMatrix.needsUpdate = true; spark.visible = sp > 0 && sp < 1;

    // ---- town life (wall clock: it never waits)
    const lane = (x0, x1, v, w0) => { const Ln = Math.abs(x1 - x0), s = ((wc * v + w0) % Ln + Ln) % Ln; return x0 + Math.sign(x1 - x0) * s; };
    const x1 = lane(-11, 12, 0.8, 3), x2 = lane(12.5, -11, 0.75, 9);
    pose(passer, V(x1, 0, 9.05), Math.PI / 2, { Walk: 1 }, wc, { phase: (wc * 0.8) / 1.3 });
    pose(passer2, V(x2, 0, 8.95), -Math.PI / 2, { Walk: 1 }, wc, { phase: (wc * 0.75) / 1.3 + 0.3 });
    pose(passerKid, V(x2 + 0.18, 0, 9.55), -Math.PI / 2, { Walk: 1 }, wc, { phase: (wc * 0.75) / (1.3 * 0.6) });
    // the neighbour shovelling the far sidewalk: push, lift, toss to the side, a breath; about every 3.4 s
    {
      const SP = V(-7.1, 0, 1.95), sy = Math.PI / 2, per = 3.4, u = ((wc % per) + per) % per / per;
      const push = ramp(u, 0.0, 0.25) * (1 - ramp(u, 0.3, 0.42)), lift = ramp(u, 0.3, 0.45) * (1 - ramp(u, 0.6, 0.72)), toss = ramp(u, 0.45, 0.58) * (1 - ramp(u, 0.7, 0.85));
      const step = 0.1 * push;
      pose(shoveller, SP.clone().add(V(-step, 0, 0)), sy + 0.45 * toss, { Idle: 1 }, wc, { off: 2 });
      bend(shoveller, 0.42 * push + 0.25 * lift - 0.05 * toss);
      const { fwd, right } = axes(shoveller), base = shoveller.obj.getWorldPosition(V()), k = S;
      const bladeAt = base.clone().addScaledVector(fwd, (0.55 + 0.2 * push) * k).addScaledVector(V(0, 1, 0), (0.04 + 0.35 * lift + 0.3 * toss) * k).addScaledVector(right, -0.25 * toss * k);
      const tilt = lerp(1.05, 0.55, lift) - 0.3 * toss;           // handle angle from the vertical, leaning back towards the body
      shovel.position.copy(L(bladeAt)); shovel.rotation.set(0, shoveller.obj.rotation.y + Math.PI, 0); shovel.rotateX(tilt); shovel.updateMatrixWorld(true);
      const top = shovel.localToWorld(V(0, 1.12, 0)), mid = shovel.localToWorld(V(0, 0.62, 0));
      reach(shoveller, 'R', top, 1, elbowPole(shoveller, 'R')); reach(shoveller, 'L', mid, 1, elbowPole(shoveller, 'L'));
      lookAt(shoveller, bladeAt, 0.6);
      // the tossed snow
      const fly = clamp((u - 0.55) / 0.3), m2 = new THREE.Matrix4();
      for (let i = 0; i < 6; i++) {
        const s = fly > 0 && fly < 1 ? 0.03 + 0.02 * ((i * 7) % 3) : 0;
        const pt = L(bladeAt).add(V((i - 2.5) * 0.04 + fly * 0.15, fly * 0.5 - fly * fly * 0.55, 0.1 + fly * (0.5 + 0.08 * i)));
        m2.compose(pt, new THREE.Quaternion(), V(s, s, s)); clumps.setMatrixAt(i, m2);
      }
      clumps.instanceMatrix.needsUpdate = true;
    }
    // chimney smoke: soft cotton puffs rising and drifting, growing then thinning away (on twos, like the puppets)
    { const m3 = new THREE.Matrix4(), q0 = new THREE.Quaternion(); let n = 0;
      chimneys.forEach((ch, ci) => {
        for (let i = 0; i < PUFFS; i++, n++) {
          const life = 4.6, ph = ((wc + i * life / PUFFS + ci * 0.37) % life) / life;
          const s = (0.1 + 0.32 * Math.sqrt(ph)) * (ph < 0.75 ? 1 : 1 - (ph - 0.75) / 0.25);
          const pt = ch.clone().add(V(0.55 * ph * ph + 0.06 * Math.sin(i * 1.7 + ph * 5), 1.5 * ph, 0.18 * ph + 0.05 * Math.cos(i * 2.3)));
          m3.compose(pt, q0, V(s, s * 0.85, s)); smoke.setMatrixAt(n, m3);
        }
      });
      smoke.instanceMatrix.needsUpdate = true; }

    sorting.evaluate(tc, wc, { door: th });
    if (tc >= sorting.s0) roomLight.intensity = 7 * S * S;
    CAST.forEach(setContact);
    // ---- facial life: everyone blinks now and then (on twos, never in step); the child screws up their eyes in a happy
    // squint as the truck goes in, then blinks up at the parent
    { const bl = (x, off, per) => { const u = (((x + off) % per) + per) % per; return u < 0.16 ? Math.sin(Math.PI * u / 0.16) : 0; };
      marine.blink.value = bl(tc, 0.3, 3.9); parent.blink.value = bl(tc, 1.7, 4.3); volunteer.blink.value = bl(tc, 2.6, 4.7);
      const squint = 0.6 * ramp(tc, T.drop1 + 0.25, T.drop1 + 0.45) * (1 - ramp(tc, T.up0 + 0.2, T.up0 + 0.45));
      const upBlink = tc > T.up1 && tc < T.up1 + 0.16 ? Math.sin(Math.PI * (tc - T.up1) / 0.16) : 0;
      child.blink.value = Math.max(bl(tc, 0.9, 3.4) * (tc < T.lift0 || tc > T.up1 + 0.8 ? 1 : 0), squint, upBlink);
      for (const [p, o] of [[passer, 0.5], [passer2, 1.9], [passerKid, 3.1], [shoveller, 2.2]]) p.blink.value = bl(wc, o, 4.1); }
    Object.assign(state, { t, truck: L(truck.getWorldPosition(V())), carton: L(carton.getWorldPosition(V())), lid, door: th,
      child: L(child.obj.getWorldPosition(V())), parent: L(parent.obj.getWorldPosition(V())), marine: L(marine.obj.getWorldPosition(V())), volunteer: L(volunteer.obj.getWorldPosition(V())),
      visible: { marine: marine.obj.visible, volunteer: volunteer.obj.visible, carton: carton.visible, truck: truck.visible }, ...sorting.state });
  }

  // ---------------------------------------------------------------- the camera: one directed path per screen shape
  // Segments of a short film. Each gives a camera position and a point it looks at, in town units; neighbouring segments
  // blend over 0.8 s so the camera never jumps. Tall (phone) screens have their own compositions, not a crop.
  const ease = (t, a, b) => smooth((t - a) / (b - a));
  const mix3 = (a, b, k) => a.clone().lerp(b, k);
  // (the camera glides: it follows the smooth path, not the puppets' steps on twos)
  const childAt = (t) => { const tc = t; return t < T.aside0 ? C_PATH.getPointAt(clamp(travel(tc, T.walk0, LC, vC).s / LC)) : A_C.getPointAt(clamp(travel(tc, T.aside0, LAC, 0.75).s / LAC)); };
  const marineAt = (t) => { const tc = t; if (t < T.mWalk0) return M_START.clone(); if (t < T.go0) return M_PATH.getPointAt(clamp(travel(tc, T.mWalk0, LM, vM).s / LM)); return M_IN.getPointAt(clamp(travel(tc, T.go0, LMI, vMI).s / LMI)); };
  const SEG = {
    wide: [
      { t0: 0, t1: 3.2, pos: (t) => mix3(V(7.6, 1.6, 7.8), V(6.3, 1.32, 6.4), ease(t, 0, 3.2)), look: (t) => mix3(V(-1.4, 1.0, 2.0), V(-1.6, 0.85, 2.3), ease(t, 0, 3.2)) },
      { t0: 3.2, t1: 7.2, pos: (t) => mix3(V(6.3, 1.32, 6.4), V(5.0, 1.2, 5.05), ease(t, 3.2, 7.2)), look: (t) => { const c = childAt(t); return V(lerp(c.x, BOX.x, 0.25), 0.66, lerp(c.z, BOX.z, 0.25)); } },
      // the donation, from beside the box on the hall's side: the truck held up over the slot, the child's face as it goes
      // in, the parent watching in full, the warm street behind (it was low behind the box: the box filled half the frame,
      // the parent was cut in half and the sign's post stood in the corner)
      { t0: 7.2, t1: 10.7, cut: true, pos: (t) => mix3(V(1.1, 1.14, 1.36), V(1.28, 1.05, 1.55), ease(t, 7.2, 10.7)), look: (t) => mix3(V(2.6, 0.99, 1.95), V(2.72, 0.9, 2.06), ease(t, 7.2, 10.7)) },
      { t0: 10.7, t1: 13.6, cut: true, pos: (t) => mix3(V(0.95, 1.5, 4.7), V(0.8, 1.55, 4.95), ease(t, 10.7, 13.6)), look: (t) => mix3(V(3.0, 0.82, 1.8), V(2.85, 0.88, 1.85), ease(t, 10.7, 13.6)) },
      { t0: 13.6, t1: T.reach0, pos: (t) => mix3(V(0.8, 1.55, 4.95), V(0.9, 1.35, 3.55), ease(t, 13.6, T.reach0)), look: (t) => { const m = marineAt(t); return mix3(V(2.85, 0.88, 1.85), V(lerp(m.x, BOX.x, 0.35), 0.95, lerp(m.z, BOX.z, 0.35)), ease(t, 13.6, 15.6)); } },
      // the collection: from the Marine's left and a little in front, high enough to see into the box: his hands, the lid,
      // the carton coming up, and the family watching beyond him (it was close behind his back, and cramped)
      { t0: T.reach0, t1: T.go0, pos: (t) => mix3(V(0.45, 1.5, 3.0), V(0.62, 1.42, 2.8), ease(t, T.reach0, T.go0)), look: (t) => mix3(V(2.35, 0.72, 1.55), V(2.4, 0.86, 1.65), ease(t, T.in0, T.go0)) },
      { t0: T.go0, t1: T.inside, cut: true, pos: (t) => t < T.go0 + 1.8 ? mix3(V(2.05, 1.6, 4.1), V(1.7, 1.55, 3.85), ease(t, T.go0, T.go0 + 1.8)) : mix3(V(1.7, 1.55, 3.85), V(1.5, 1.45, 3.05), ease(t, T.go0 + 1.8, T.inside)), look: (t) => { const m = marineAt(t); const k = ease(t, T.go0, T.inside); return V(lerp(m.x, 0, 0.3 + 0.5 * k), lerp(1.0, 1.15, k), lerp(m.z, 0.1, 0.3 + 0.5 * k)); } },
      { t0: T.inside, t1: T.end + 0.2, pos: (t) => mix3(V(1.5, 1.45, 3.05), V(1.3, 1.48, 2.7), ease(t, T.inside, T.end)), look: (t) => mix3(V(0.05, 1.18, 0.15), V(0.0, 1.3, 0.05), ease(t, T.inside, T.end)) },
    ],
  };
  // tall screens: wider, a little higher; the subject centred and the action kept in the middle third
  // the donation on phones has its own shot: from above the volunteer's head on the hall side, looking down past the slot,
  // so the truck, the child's face and the parent stack in the narrow frame (pulled back, the volunteer's wave crossed it)
  const TALL_DONATION = { pos: (t) => mix3(V(1.72, 1.84, 1.16), V(1.8, 1.76, 1.26), ease(t, 7.2, 10.7)), look: (t) => mix3(V(2.72, 1.1, 2.02), V(2.78, 1.05, 2.08), ease(t, 7.2, 10.7)) };
  SEG.tall = SEG.wide.map((s, i) => i === 2 ? { t0: s.t0, t1: s.t1, cut: s.cut, ...TALL_DONATION } : ({ t0: s.t0, t1: s.t1, cut: s.cut,
    pos: (t) => { const p = s.pos(t), l = s.look(t), k = [1.1, 1.18, 1.35, 1.45, 1.4, 1.35, 1.35, 1.3][i]; return l.clone().add(p.clone().sub(l).multiplyScalar(k)).add(V(0, [0.75, 0.6, 0.6, 0.3, 0.3, 0.32, 0.28, 0.2][i], 0)); },
    look: (t) => { const l = s.look(t).add(V(0, [0.0, 0.12, 0.02, 0.05, 0.05, 0.05, 0.08, 0.0][i], 0)); if (i === 4) { const m = marineAt(t); return l.lerp(V(m.x, 0.95, m.z), 0.4 * ease(t, 13.6, 15.2)); } return l; } }));
  // the sorting room's shots follow on (the collection's last shot ends where they begin)
  for (const k of ['wide', 'tall']) { SEG[k][SEG[k].length - 1].t1 = sorting.s0; SEG[k].push(...sorting.shots[k]); }
  const BLEND = 0.8;
  function segIndex(t, segs) { let i = 0; while (i < segs.length - 1 && t >= segs[i].t1) i++; return i; }
  function camera(t, { tall = innerWidth < innerHeight, reduced = false } = {}) {
    const segs = tall ? SEG.tall : SEG.wide, i = segIndex(t, segs), s = segs[i];
    if (reduced) {                          // a stable composition for each segment; the story crossfades between them
      const tm = s.still ?? s.t0 + (s.t1 - s.t0) * 0.62, p = s.pos(tm); return { pos: W(p), look: W(s.look(tm)), seg: i, cut: !!s.cut, flash: 0, inside: sorting.insideK(p) };
    }
    let pos = s.pos(t), look = s.look(t);
    const prev = segs[i - 1];
    if (prev && !s.cut && t < s.t0 + BLEND) { const k = smooth((t - s.t0) / BLEND); pos = prev.pos(t).lerp(pos, k); look = prev.look(t).lerp(look, k); }
    return { pos: W(pos), look: W(look), seg: i, cut: !!s.cut, flash: sorting.crossing(pos), inside: sorting.insideK(pos) };
  }

  return {
    group, beats: BEATS, times: T, duration: BEATS.sorting[1], evaluate, camera, state, town, ground, footing, sorting,
    probeH: (x, y, z) => { let sc = root; while (sc.parent) sc = sc.parent; const rc = new THREE.Raycaster(root.localToWorld(V(x, y, z)), V(0, 0, -1)); return rc.intersectObjects(sc.children, true).filter((h) => !h.object.isSkinnedMesh && !h.object.isPoints).slice(0, 8).map((h) => [h.object.name || h.object.type, h.object.parent && h.object.parent.name, +L(h.point).z.toFixed(3), h.object.visible]); },
    probeAll: (x, z) => { let sc = root; while (sc.parent) sc = sc.parent; const rc = new THREE.Raycaster(root.localToWorld(V(x, 1.2, z)), V(0, -1, 0)); return rc.intersectObjects(sc.children, true).slice(0, 6).map((h) => [h.object.name || h.object.type, +L(h.point).y.toFixed(3)]); },
    cast: { marine, parent, child, volunteer, ...sorting.cast },
    clipPlane, chimneys: chimneys.length, chimneyAt: chimneys.map((c) => c.toArray().map((x) => +x.toFixed(2))),
    truckWorld: () => truck.getWorldPosition(V()),
    debugBones: () => Object.fromEntries(Object.entries(marine.bones).map(([k, b]) => [k, b.quaternion.toArray().map((x) => +x.toFixed(3))])),
  };
}
