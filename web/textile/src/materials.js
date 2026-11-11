// The textile material set, made once and shared. Every material samples one generated detail texture per pixel
// (see vendor/textile_materials.js); no per-pixel noise, no fur shells. Identity comes from construction.
import * as THREE from 'three';
import { textileMaterial, threadMaterial, yarnMaterial as rawYarn, timeU } from './vendor/textile_materials.js';
import { cardMaterial } from './vendor/paper_materials.js';

export { timeU };
/**
 * The experiment's bump step ends in normalize(abs(det) * normal - sign(det) * (...)). Where a pixel's screen
 * derivatives collapse (det = 0) that is normalize(vec3(0)) = NaN, and bloom spreads one NaN pixel into a black block.
 * guard() rewrites that line so such a pixel keeps its unperturbed normal. Applied to every textile material.
 */
const BUMP = 'normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));';
const SAFE = '{ vec3 nn_ = abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2); if (dot(nn_, nn_) > 1e-12) normal = normalize(nn_); }';
export function guard(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.split(BUMP).join(SAFE); };
  const key = m.customProgramCacheKey; m.customProgramCacheKey = () => key.call(m) + '-safe';
  return m;
}
export const yarnMaterial = (c, t) => guard(rawYarn(c, t));
let MATS = null;
export function materials() {
  if (MATS) return MATS;
  MATS = {
    felt: textileMaterial('felt'), woven: textileMaterial('woven'), print: textileMaterial('print'), batt: textileMaterial('batt'),
    paint: textileMaterial('paint'), glow: textileMaterial('glow', { glow: 1.5, side: THREE.DoubleSide }), card: cardMaterial({ side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.32 }),
    bead: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
    thread: threadMaterial(),
    lights: textileMaterial('glow', { glow: 2.8, name: 'treeLights' }),
    lamp: textileMaterial('glow', { glow: 2.2, side: THREE.DoubleSide, name: 'lampPanes' }),
  };
  for (const m of Object.values(MATS)) if (m.onBeforeCompile && m.customProgramCacheKey) guard(m);
  return MATS;
}

/** turn a finished kit (vendor makeKit + extendKit) into meshes: one per material batch, stitches instanced, yarns as tubes */
export function kitMeshes(k, { cast = true, extra = {} } = {}) {
  const m = materials(), out = [];
  for (const n of ['felt', 'woven', 'print', 'paint', 'card', 'metal', 'bead', 'batt', 'glow']) {
    const me = k.B[n].mesh(m[n], { cast: cast && n !== 'glow', receive: true }); if (me) out.push(me);
  }
  for (const [n, b] of Object.entries(extra)) { const me = b.mesh(m[n], { cast: false }); if (me) out.push(me); }
  if (k.S.items.length) out.push(k.S.build(m.thread));
  for (const y of k.yarns) { const me = new THREE.Mesh(y.g, yarnMaterial(y.color, y.twists)); me.castShadow = cast; me.receiveShadow = true; out.push(me); }
  return out;
}

/**
 * Re-clothe an existing (clay) mesh in a textile material without changing its shape: adds the attributes the
 * textile shaders need, with UVs projected from above (for ground snow: batting laid over the land).
 */
export function clothe(mesh, kind, color) {
  const g = mesh.geometry, n = g.attributes.position.count, p = g.attributes.position;
  const uv = new Float32Array(n * 2), col = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(n), 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n).fill(0.37), 1));
  g.setAttribute('aExtra', new THREE.BufferAttribute(new Float32Array(n), 1));
  const prev = mesh.material; mesh.userData.clayMaterial = prev; mesh.material = materials()[kind];
  return () => { mesh.material = prev; };
}
