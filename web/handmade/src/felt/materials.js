// Experiment B — felt, wool, thread and woven fabric.
//
// What makes felt read as felt (from looking at real felt crafts, close up):
//   1. a matte, fibrous surface with no specular highlight, but a soft bright "sheen" at grazing angles
//      (light catching the loose surface fibres);
//   2. a fuzzy silhouette: stray fibres stand off every surface and blur its outline;
//   3. thickness with soft, slightly ragged cut edges; stuffed pieces are puffy;
//   4. construction you can see: stitches, seams, appliqué, buttons.
// (1) is the material here, (2) is the shell fuzz below, (3)–(4) are geometry (felt/kit.js).
import * as THREE from 'three';
import { GLSL_NOISE, GLSL_TRIPLANAR, periodicFbm, wrapStroke, packTexture, canvasChannel, rng } from '../kit.js';

export const timeU = { value: 0 };
export const fuzzU = { len: { value: 0.022 }, shells: { value: 6 } };

// ------------------------------------------------------------------ the felt tile: a dense mat of short curly fibres
let FELT_TEX = null;
export function feltTexture() {
  if (FELT_TEX) return FELT_TEX;
  const n = 512, r = rng(31);
  const cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
  g.fillStyle = '#6e6e6e'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) {     // fibres: short, curly, criss-crossing, light and dark
    const x = r() * n, y = r() * n, a = r() * Math.PI * 2, L = 5 + r() * 22, c1 = a + (r() - 0.5) * 2.4, v = r() < 0.5 ? 20 + r() * 70 : 150 + r() * 105;
    wrapStroke(g, n, (gg) => {
      gg.strokeStyle = `rgba(${v},${v},${v},${0.2 + r() * 0.4})`; gg.lineWidth = 0.6 + r() * 1.0; gg.beginPath(); gg.moveTo(x, y);
      gg.bezierCurveTo(x + Math.cos(c1) * L * 0.6, y + Math.sin(c1) * L * 0.6, x + Math.cos(a) * L * 0.6, y + Math.sin(a) * L * 0.6, x + Math.cos(a + 0.6) * L, y + Math.sin(a + 0.6) * L); gg.stroke();
    });
  }
  const fib = canvasChannel(cv);
  const clump = periodicFbm(n, 10, 4, 41, 0.6);     // denser and thinner patches of the mat
  const mott = periodicFbm(n, 4, 3, 43, 0.5);
  const h = new Float32Array(n * n); for (let i = 0; i < h.length; i++) h[i] = 0.55 * fib[i] + 0.45 * clump[i];
  FELT_TEX = packTexture(n, [h, fib, mott, clump]);
  return FELT_TEX;
}

const FELT_VERT_HEAD = `
  attribute float aEdge; attribute float aSeed; attribute float aExtra;
  varying float vEdge; varying float vSeed; varying float vExtra; varying vec3 vP; varying vec3 vON;`;
const FELT_FRAG_HEAD = `
  uniform sampler2D tFelt; uniform float uScale; varying float vEdge; varying float vSeed; varying float vExtra; varying vec3 vP; varying vec3 vON;`;
const FELT_COLOR = `
  vec3 pp = vP + vec3(fract(vSeed * 7.31), fract(vSeed * 3.17), fract(vSeed * 5.73)) * 9.0;
  vec4 tx = triplanar(tFelt, pp, normalize(vON), uScale);
  float edge = smoothstep(0.3, 0.95, vEdge);
  // wool is a blend of slightly different fibres: lighter and darker hairs, gentle mottling
  diffuseColor.rgb *= (0.9 + 0.16 * tx.b) * (0.9 + 0.2 * tx.g);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.05, 0.98, 0.95), smoothstep(0.6, 0.9, tx.a) * 0.4);
  diffuseColor.rgb *= 1.0 - 0.1 * edge;`;

/** felt for panels and stuffed shapes; glow > 0 makes thin felt lit from behind (windows) */
export function feltMaterial({ name = 'felt', scale = 5.0, bump = 0.006, sheen = 0.9, glow = 0, glowColor = 0xffb35a, side = THREE.FrontSide } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, sheen, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.75, 0.72, 0.68), side });
  if (glow) { m.emissive = new THREE.Color(glowColor); m.emissiveIntensity = glow; }
  m.name = name; m.userData.light = { value: 1 };
  const tex = feltTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tFelt = { value: tex }; sh.uniforms.uScale = { value: scale }; sh.uniforms.uLight = m.userData.light;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + FELT_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vEdge = aEdge; vSeed = aSeed; vExtra = aExtra; vP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uLight;' + FELT_FRAG_HEAD + GLSL_NOISE + GLSL_TRIPLANAR)
      .replace('#include <color_fragment>', '#include <color_fragment>' + FELT_COLOR)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(normal, -vViewPosition, tx.r + 0.5 * tx.a, ${bump.toFixed(4)});`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= uLight * vColor.rgb * (0.45 + 0.9 * (1.0 - tx.a)) * (0.7 + 0.5 * tx.g);`);
  };
  m.customProgramCacheKey = () => `felt-${scale}-${bump}-${glow > 0}`;
  return m;
}

/**
 * Shell fuzz: the same geometry drawn N more times, each copy pushed out along the normal and cut down to a sparser
 * set of fibres (discard), so stray hairs stand off the surface and soften every silhouette. One instanced draw per
 * mesh; the shell index is gl_InstanceID. aExtra scales the fibre length per piece (wool snow ≫ felt panels).
 */
export function fuzzMaterial({ scale = 5.0, density = 1.0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const tex = feltTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tFelt = { value: tex }; sh.uniforms.uScale = { value: scale }; sh.uniforms.uLen = fuzzU.len; sh.uniforms.uShells = fuzzU.shells; sh.uniforms.uDensity = { value: density };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + FELT_VERT_HEAD + '\nuniform float uLen; uniform float uShells; varying float vH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEdge = aEdge; vSeed = aSeed; vExtra = aExtra; vP = position; vON = normal;
        vH = (float(gl_InstanceID) + 1.0) / uShells;
        // fibres droop a little as they get longer
        transformed += normalize(objectNormal) * vH * uLen * aExtra - vec3(0.0, 1.0, 0.0) * vH * vH * uLen * aExtra * 0.25;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + FELT_FRAG_HEAD + '\nuniform float uDensity; varying float vH;' + GLSL_NOISE + GLSL_TRIPLANAR + `
        float fibreFam(vec3 p, vec3 d, float lo, float hi){ vec3 q = p*hi + d*dot(p,d)*(lo-hi); float n = vn3(q); return pow(1.0-abs(2.0*n-1.0), 5.0); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          vec3 q = vP + vec3(fract(vSeed * 7.31), fract(vSeed * 3.17), fract(vSeed * 5.73)) * 9.0;
          float f = max(max(fibreFam(q, vec3(0.8,0.1,0.59), 30.0, 380.0), fibreFam(q + 3.1, vec3(-0.3,0.9,0.31), 30.0, 380.0)), fibreFam(q + 7.7, vec3(0.2,-0.4,0.89), 30.0, 380.0));
          float tuft = vn3(q * 55.0);
          if (f * (0.5 + 0.6 * tuft) * uDensity < 0.22 + 0.8 * vH) discard;
        }`)
      .replace('#include <color_fragment>', '#include <color_fragment>' + FELT_COLOR + '\n diffuseColor.rgb *= 0.88 + 0.12 * vH;');
  };
  m.customProgramCacheKey = () => 'felt-fuzz-' + density;
  return m;
}
/** shells for a mesh (shares its geometry buffers) */
export function makeFuzz(mesh, mat) {
  const src = mesh.geometry, g = new THREE.InstancedBufferGeometry();
  for (const k of Object.keys(src.attributes)) g.setAttribute(k, src.attributes[k]);
  if (src.index) g.setIndex(src.index);
  g.instanceCount = fuzzU.shells.value; g.boundingSphere = src.boundingSphere; g.boundingBox = src.boundingBox;
  const f = new THREE.Mesh(g, mat); f.castShadow = false; f.receiveShadow = true; f.name = mesh.name + ':fuzz';
  f.position.copy(mesh.position); f.quaternion.copy(mesh.quaternion); f.scale.copy(mesh.scale);
  f.userData.fuzz = true;
  return f;
}

/** embroidery floss / sewing thread: a twisted ply pattern along each stitch, a soft satin sheen */
export function threadMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(1, 1, 1) });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float ply = sin((vUv.x * 4.0 + vUv.y * 7.0) * 6.2832); normal = normalize(normal + 0.35 * ply * normalize(cross(normal, vec3(0.0, 1.0, 0.0) + 0.01))); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 0.82 + 0.18 * (0.5 + 0.5 * sin((vUv.x * 4.0 + vUv.y * 7.0) * 6.2832));`);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n#ifndef USE_UV\nvarying vec2 vUv;\n#endif').replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifndef USE_UV\nvUv = uv;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n#ifndef USE_UV\nvarying vec2 vUv;\n#endif');
  };
  m.customProgramCacheKey = () => 'felt-thread';
  return m;
}

/** woven cotton for the presents: gingham / tartan from two colours, with a woven micro-relief */
export function fabricMaterial(c1, c2, { pattern = 'gingham', check = 0.09 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.82, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.9, 0.9, 0.9) });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uC1 = { value: new THREE.Color(c1) }; sh.uniforms.uC2 = { value: new THREE.Color(c2) }; sh.uniforms.uCheck = { value: check };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP; varying vec3 vON;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uC1, uC2; uniform float uCheck; varying vec3 vP; varying vec3 vON;' + GLSL_NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 n = abs(normalize(vON)); vec2 st = n.x > n.y && n.x > n.z ? vP.zy : (n.y > n.z ? vP.xz : vP.xy);
        vec2 g = fract(st / uCheck);
        ${pattern === 'gingham'
    ? 'float a = step(0.5, g.x), b = step(0.5, g.y); vec3 col = mix(vec3(1.0), uC1, 0.5 * (a + b)); col = mix(col, uC2, 0.0);'
    : 'float a = step(0.5, g.x), b = step(0.5, g.y); float t = smoothstep(0.45, 0.5, abs(g.x - 0.5)) + smoothstep(0.45, 0.5, abs(g.y - 0.5)); vec3 col = mix(uC1, uC1 * 0.55, 0.5 * (a + b)); col = mix(col, uC2, clamp(t, 0.0, 1.0));'}
        // the weave: threads over and under
        vec2 w = fract(st * 260.0); float weave = (step(0.5, fract(floor(st.x * 260.0) * 0.5 + floor(st.y * 260.0) * 0.5)) > 0.5 ? w.x : w.y);
        diffuseColor.rgb = col * (0.9 + 0.12 * weave) * (0.95 + 0.1 * vn3(vP * 30.0));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(normal, -vViewPosition, weave, 0.0012);`);
  };
  m.customProgramCacheKey = () => 'felt-fabric-' + pattern;
  return m;
}
