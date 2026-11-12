// The claymation diorama host: one renderer, one scene, the shared landscape (terrain, village set,
// instanced trees, trains, lights, snow, smoke), camera moves and a frame loop.
//
// It knows nothing about the journey. The map provider, the village and the characters each
// drive it through this small API, so a different map (e.g. the 2D folk-art national map) can sit
// in front of the same village without touching it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { sanitizePass } from './sanitize_pass.js';
import { feltTexture } from '../../../textile/src/vendor/felt_materials.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const B = (x, y, z = 0) => V(x, z, -y);              // Blender (x, y, z) -> three.js
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const ramp = (t, a, b) => smooth((t - a) / (b - a));

// ------------------------------------------------------------------ hand-made surface shader (world space, scale-aware)
const NOISE = /* glsl */`
varying vec3 vWPos;
float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
float cells(vec3 p){ vec3 i=floor(p), f=fract(p); float d=1.0;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec3 o=vec3(x,y,z);
    vec3 r=o+vec3(h3(i+o),h3(i+o+7.1),h3(i+o+3.3))-f; d=min(d,dot(r,r)); } return sqrt(d); }
`;
const KINDS = { clay: 0, wood: 0, cobble: 0, snow: 1, fabric: 2, felt: 3, terrain: 4, water: 5 };
export const timeU = { value: 0 };
// 1 = the felt look: the same world re-skinned as soft wool felt (no fibres), quilted ground, batting snow, stitched
// water. One shared uniform, so every patched material switches at once and nothing has to be rebuilt.
export const feltU = { value: 0 };
const feltTexU = { value: null };   // the felt test's own wool tile (vendor feltTexture), made on first use
const FELT_GLSL = /* glsl */`
// distance (m) to the nearest quilting seam of a diamond grid, and the position along that seam
vec2 quilt(vec2 xz, float S){ vec2 q = vec2(xz.x + xz.y, xz.x - xz.y) / (S * 1.4142);
  vec2 f = abs(fract(q) - 0.5); float du = (0.5 - f.x), dv = (0.5 - f.y);
  return du < dv ? vec2(du * S * 1.4142, q.y * S * 1.4142) : vec2(dv * S * 1.4142, q.x * S * 1.4142); }
// a running stitch along a seam: 1 on the thread, anti-aliased, fading out when it gets thinner than a pixel
vec4 triplanar(sampler2D t, vec3 p, vec3 n, float s){
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(t, p.yz * s) * w.x + texture2D(t, p.xz * s + 0.37) * w.y + texture2D(t, p.xy * s + 0.71) * w.z; }
float stitch(float d, float along, float w, float dash){
  float px = fwidth(d) + 1e-4, ww = max(w, px);
  float on = smoothstep(ww + px, ww, d) * step(fract(along / dash), 0.58);
  return on * clamp(w / ww, 0.0, 1.0); }
`;
export function patch(mat, kind, extras = {}, local = false) {
  const c2 = extras.color2 ? new THREE.Color().fromArray(extras.color2) : null;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKind = { value: KINDS[kind] ?? 0 };
    sh.uniforms.uC2 = { value: c2 || new THREE.Color(1, 1, 1) };
    sh.uniforms.uT = timeU; sh.uniforms.uFelt = feltU; sh.uniforms.tFelt = feltTexU;
    const src = local ? 'vec4(position, 1.0)' : '(modelMatrix * vec4(transformed, 1.0))';
    const srcI = local ? 'vec4(position, 1.0)' : '(modelMatrix * instanceMatrix * vec4(transformed, 1.0))';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n#ifdef USE_INSTANCING\nvWPos = ${srcI}.xyz;\n#else\nvWPos = ${src}.xyz;\n#endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform int uKind; uniform vec3 uC2; uniform float uT; uniform float uFelt; uniform sampler2D tFelt;\n' + NOISE + FELT_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uKind == 4) { float m = fbm(vWPos * 0.09) * 0.6 + fbm(vWPos * 0.6) * 0.4; diffuseColor.rgb *= 0.82 + 0.36 * m; }
        else {
          float drift = fbm(vWPos * 0.9);
          if (uKind == 2) { float st = step(0.5, fract((vWPos.x + 0.025*fbm(vWPos*4.0)) / 0.64)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, st); }
          diffuseColor.rgb *= uKind == 3 ? 0.92 + 0.16 * drift : 0.86 + 0.28 * drift;
        }
        float fThread = 0.0; vec4 ftx = vec4(0.5);
        if (uFelt > 0.5) {
          // wool: the felt test's fibre tile (lighter and darker hairs, clumps), mapped in world space
          ftx = triplanar(tFelt, vWPos, normalize(cross(dFdx(vWPos), dFdy(vWPos))), 3.0);
          diffuseColor.rgb *= (0.9 + 0.16 * ftx.b) * (0.9 + 0.2 * ftx.g) * (0.96 + 0.08 * fbm(vWPos * 0.7));
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = max(mix(vec3(lum), diffuseColor.rgb, 1.18), 0.0);   // dyed wool: a touch richer than clay
          if (uKind == 4) {             // the ground is a quilt: puffs between stitched seams
            vec2 qs = quilt(vWPos.xz, 26.0);
            diffuseColor.rgb *= 0.8 + 0.2 * smoothstep(0.0, 4.5, qs.x);
            fThread = stitch(qs.x, qs.y, 0.11, 1.1);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.84, 0.62), fThread * 0.85);
          } else if (uKind == 5) {      // navy felt water with wavy running stitches
            float wy = vWPos.z + 0.9 * sin(vWPos.x * 0.35) + 0.5 * sin(vWPos.x * 0.11 + 1.7);
            float d = abs(fract(wy / 7.0) - 0.5) * 7.0;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.15, 0.36), 0.7);
            fThread = stitch(d, vWPos.x, 0.07, 0.8);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.8, 0.62), fThread * 0.8);
          } else if (uKind == 1) {      // batting snow: bright, a little uneven
            diffuseColor.rgb *= 0.95 + 0.07 * fbm(vWPos * 0.8);
          }
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h, amp;
          if (uKind == 4) { h = 0.8*cells(vWPos*0.35 + fbm(vWPos*0.08)) + 0.7*fbm(vWPos*1.4) + 0.25*fbm(vWPos*6.0); amp = 0.18; }
          else if (uKind == 5) { h = fbm(vWPos*vec3(0.6,0.6,0.6) + vec3(uT*0.15, 0.0, uT*0.08)) + 0.4*fbm(vWPos*2.3 - uT*0.2); amp = 0.06; }
          else if (uKind == 1) { h = -0.9*cells(vWPos*11.0) - 0.35*cells(vWPos*34.0) + 0.6*fbm(vWPos*6.0); amp = 0.035; }
          else if (uKind == 3) { h = 0.5*fbm(vWPos*60.0) + 0.5*fbm(vWPos*160.0) + 0.4*cells(vWPos*9.0); amp = 0.006; }
          else { h = 0.9*cells(vWPos*3.5 + fbm(vWPos*1.2)) + 0.6*fbm(vWPos*7.0) + 0.15*fbm(vWPos*90.0); amp = 0.025; }
          if (uFelt > 0.5) {          // felt: soft stuffed puffs and a fine wool nap, no thumbprints
            if (uKind == 4) { vec2 qs = quilt(vWPos.xz, 26.0); h = 1.6 * smoothstep(0.0, 6.0, qs.x) + 0.3 * fbm(vWPos * 0.15) + 0.05 * fbm(vWPos * 5.0); amp = 0.45; }
            else if (uKind == 1) { h = fbm(vWPos * 0.9) + 0.25 * fbm(vWPos * 7.0); amp = 0.05; }
            else if (uKind == 5) { h = 0.4 * fbm(vWPos * 0.5) + 0.1 * fbm(vWPos * 8.0); amp = 0.05; }
            else { h = 0.7 * fbm(vWPos * 1.6) + 0.3 * (ftx.r + 0.5 * ftx.a); amp = 0.012; }
          }
          float far = clamp(length(vViewPosition) / (uKind == 4 ? 900.0 : 160.0), 0.0, 1.0);
          amp *= 1.0 - 0.85 * far;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(h)*amp, dhy = dFdy(h)*amp;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 nb = abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2);
          normal = dot(nb, nb) > 1e-12 ? normalize(nb) : normal;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (uFelt > 0.5 && uKind != 5) roughnessFactor = max(roughnessFactor, 0.93);
        if (uFelt > 0.5 && uKind == 5) roughnessFactor = 0.9;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        if (uFelt > 0.5) metalnessFactor = 0.0;`)
      .replace('#include <opaque_fragment>', `
        if (uFelt > 0.5) {   // felt sheen: loose surface fibres catch the light at grazing angles
          float g = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
          outgoingLight += g * 0.55 * totalDiffuse * vec3(1.0, 0.97, 0.92);
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'tt2-' + kind + (local ? '-l' : '');
}

// ------------------------------------------------------------------ quality tiers
export function pickQuality(override) {
  if (override && ['high', 'medium', 'low'].includes(override)) return override;
  const coarse = matchMedia('(pointer: coarse)').matches, small = Math.min(innerWidth, innerHeight) < 700;
  const mem = navigator.deviceMemory || 8;
  if (mem <= 2) return 'low';
  if (coarse || small || mem <= 4) return 'medium';
  return 'high';
}
const TIERS = {
  high: { post: true, ao: true, dof: true, shadows: true, shadowMap: 2048, dpr: 1.5, snow: 6000 },
  medium: { post: true, ao: false, dof: false, shadows: true, shadowMap: 1024, dpr: 1.0, snow: 2500 },
  low: { post: false, ao: false, dof: false, shadows: false, shadowMap: 512, dpr: 0.85, snow: 1200 },
};

// ------------------------------------------------------------------ load
export function makeLoader(base, b64map) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cache = {};
  return function load(name, onBytes) {
    if (cache[name]) return cache[name];
    cache[name] = (async () => {
      const b64 = b64map && b64map[name];
      let buf;
      if (b64) { const txt = await (await fetch(b64)).text(); buf = Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0)).buffer; }
      else { const r = await fetch(base + name); if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`); buf = await r.arrayBuffer(); }
      onBytes && onBytes(name, buf.byteLength);
      return loader.parseAsync(buf, '');
    })();
    return cache[name];
  };
}

/**
 * createDiorama({ container, base, b64, quality, onStatus }) -> host
 * Throws if WebGL is unavailable; the caller falls back to the illustrated view.
 */
export async function createDiorama({ container, base, b64, quality = 'high', onStatus = () => {}, preserve = false, look = null }) {
  // look: null = the original village exactly as before. 'clay' / 'textile' = the textile comparison
  // (experiment/textile-toytown): the village is loaded without its hero corner, and both versions of the corner
  // (clay and textile) are added, with host.setLook() switching between them.
  const cfg = { ...TIERS[quality], tier: quality, lampShadows: false };
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.dpr));
  renderer.setSize(container.clientWidth || innerWidth, container.clientHeight || innerHeight);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = cfg.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const W = () => container.clientWidth || innerWidth, H = () => container.clientHeight || innerHeight;

  const scene = new THREE.Scene();
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0d0f20'); gr.addColorStop(0.55, '#262035'); gr.addColorStop(0.82, '#5a3c38'); gr.addColorStop(1, '#2a1c1c');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  }
  const fogNear = new THREE.Color(0x2a2030), fogFar = new THREE.Color(0x2b3346);
  // the felt look lights the whole region like the felt style test: a deep-blue night, warm key, cool rim, more bloom
  const RL = { exposure: 1.25, key: 2.6, hemiK: 1 };
  const nightSky = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0a0c1f'); gr.addColorStop(0.55, '#12183a'); gr.addColorStop(0.82, '#26315e'); gr.addColorStop(1, '#141a32');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  scene.fog = new THREE.FogExp2(fogNear.clone(), 0.018);
  const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.2, 2500);
  let fovH = 45;
  const setFovH = (h) => {
    fovH = h;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect));
    // portrait phones: keep the vertical view from getting absurdly tall
    if (camera.aspect < 1) camera.fov = Math.min(camera.fov, 72);
    camera.updateProjectionMatrix();
  };

  const load = makeLoader(base, b64);
  const bytes = {};
  onStatus('Unpacking the miniature world…', 0.05);
  const meta = await (await fetch(base + 'region.json')).json();
  let done = 0;
  const names = ['static.glb', 'static_lo.glb', 'terrain.glb', 'protos.glb', 'protos_lo.glb'];
  const textileBase = window.TT_TEXTILE_ASSETS || '../textile/assets/', loadT = makeLoader(textileBase, b64);
  const tick = (k, b) => { bytes[k] = b; onStatus('Unpacking the miniature world…', 0.1 + 0.8 * (++done / (names.length + (look ? 1 : 0)))); };
  const [stat, statLo, terr, prot, protLo, cornerClay, housesClay] = await Promise.all(look
    ? [loadT('static_base.glb', tick), loadT('static_base_lo.glb', tick), load('terrain.glb', tick), load('protos.glb', tick), load('protos_lo.glb', tick), loadT('corner_clay.glb', tick),
      look === 'felt' && window.TT_ONLY_LOOK ? null : loadT('houses_clay.glb', tick)]   // the felt-only build sews every house: no clay houses to load
    : names.map((n) => load(n, tick)));

  // ---------------- static set
  const collidables = [], shopGlow = [], doorParts = [];
  function prepStatic(root, isLo) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeVertexNormals();
      const m = o.material, ex = m.userData || {}, kind = ex.kind || 'clay';
      if (kind === 'ice') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.1; }
      if (KINDS[kind] !== undefined) patch(m, kind, ex);
      if (kind === 'snow') { m.roughness = 0.75; m.color.multiplyScalar(1.05); }
      if (kind === 'water') { m.roughness = 0.12; m.metalness = 0.0; }
      if (m.emissiveIntensity > 0) { if (m.name.includes('ShopGlow')) shopGlow.push(m); m.emissiveIntensity *= 0.6; }
      o.castShadow = !['glow', 'emissive', 'water'].includes(kind) && !/GroundSnow|Table|BoardEdge/.test(o.name);
      o.receiveShadow = true;
      if (!isLo) { if (o.name.startsWith('door_')) doorParts.push(o); else collidables.push(o); }
    });
  }
  prepStatic(stat.scene, false); prepStatic(statLo.scene, true);
  scene.add(stat.scene, statLo.scene); statLo.scene.visible = false;
  const clayCornerMeshes = [];
  if (cornerClay) { const n0 = collidables.length; prepStatic(cornerClay.scene, false); clayCornerMeshes.push(...collidables.slice(n0)); scene.add(cornerClay.scene); }
  // the region's other houses: clay (comparison looks) or sewn felt (felt look), swapped by setLook
  const clayHouseMeshes = [];
  if (housesClay) { const n0 = collidables.length; prepStatic(housesClay.scene, false); clayHouseMeshes.push(...collidables.slice(n0)); scene.add(housesClay.scene); }
  let feltHouses = null;
  terr.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeVertexNormals();
    o.material.vertexColors = true; o.material.roughness = 0.85; o.material.color.set(0xffffff);
    patch(o.material, 'terrain');
    o.receiveShadow = true; o.castShadow = true; collidables.push(o);
  });
  scene.add(terr.scene);
  const door = new THREE.Object3D(); door.position.fromArray(meta.door_hinge); scene.add(door);
  scene.updateMatrixWorld(true);
  for (const m of doorParts) door.attach(m);
  // ---------------- the textile corner (comparison only): built in the browser from corner.json, same positions
  let textile = null;
  const lookListeners = new Set();
  let baseHidden = null;          // the felt look's own world is showing: the clay village is hidden, the light is its own
  let feltNear = false;           // ...but only once the camera is down in the town (the map and the descent need the region)
  if (look) {
    onStatus('Sewing the textile corner…', 0.92);
    const [TX, FX] = await Promise.all([import('../../../textile/src/corner.js'), import('../../../textile/src/felt_corner.js')]);
    const spec = await (await fetch(textileBase + 'corner.json')).json();
    // the ground snow is re-clothed as cotton batting while a textile or felt look is on
    const ground = []; stat.scene.traverse((o) => { if (o.isMesh && /GroundSnow/.test(o.name)) ground.push(o); });
    textile = { module: TX, spec, corners: {}, ground, unclothe: [], build: { textile: TX.buildCorner, felt: FX.buildFeltCorner } };
    // a look's corner is built the first time it is shown (the felt corner costs nothing until someone asks for it)
    textile.ensure = (l) => {
      if (textile.corners[l]) return textile.corners[l];
      const c = textile.build[l](spec); c.look = l;
      scene.add(c.group); c.door.position.copy(c.doorPivot).sub(door.position); door.add(c.door);
      for (const m of c.collide) m.geometry.computeBoundsTree();
      c.group.visible = false; c.door.visible = false;
      return (textile.corners[l] = c);
    };
    if (look === 'textile') textile.ensure('textile');   // other corners are built when first shown
    // the region's houses sewn in felt (houses.json): built when the felt look is first shown
    const houseSpec = await (await fetch(textileBase + 'houses.json')).json();
    textile.feltHouses = () => {
      if (feltHouses) return feltHouses;
      feltHouses = TX.buildFeltHouses(houseSpec.houses);
      for (const m of feltHouses.collide) m.geometry.computeBoundsTree();
      feltHouses.group.visible = false; scene.add(feltHouses.group);
      console.debug('felt houses', feltHouses.count, feltHouses.triangles, 'triangles', Math.round(feltHouses.buildMs), 'ms');
      return feltHouses;
    };
    Object.defineProperty(textile, 'corner', { get: () => textile.corners[host.look] || textile.corners.textile });
  }
  for (const m of collidables) m.geometry.computeBoundsTree();
  // ---------------- the felt look: the felt style test's own street and rendering, crossfaded in when down in town
  let felt = null, feltBuilding = null, hostRef;
  const makeFelt = () => feltBuilding || (feltBuilding = (async () => {
    const [FT, mg] = await Promise.all([import('../../../textile/src/felt_town.js'), load('marine.glb')]);
    const R = textile.spec.roots;
    const built = FT.buildFeltTown({ marine: mg, renderer, camera, width: W(), height: H(), dpr: renderer.getPixelRatio(), post: cfg.post && cfg.ao,
      spots: { lamp: [R.LampWest.pos[0], R.LampWest.pos[2]], wagon: [R.Wagon.pos[0], R.Wagon.pos[2], R.Wagon.rot_z] } });
    felt = built; felt.mix = 0; felt.shared = new Set();
    felt.clayRT = new THREE.WebGLRenderTarget(W() * renderer.getPixelRatio(), H() * renderer.getPixelRatio(), { type: THREE.HalfFloatType });
    felt.blend = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tA: { value: null }, tB: { value: null }, uK: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tA, tB; uniform float uK; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(tA, vUv), texture2D(tB, vUv), uK); }' }));
    felt.blendScene = new THREE.Scene(); felt.blendScene.add(felt.blend); felt.blendCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    for (const m of felt.collide) m.geometry.computeBoundsTree();
    for (const o of pendingShare) felt.shared.add(o);
    if (typeof hostRef !== 'undefined' && hostRef.look === 'felt') hostRef.poses = felt.poses;   // (when built later, on a switch)
    return felt;
  })());
  const pendingShare = new Set();
  if (look === 'felt') { onStatus('Stitching the felt street…', 0.95); await makeFelt(); }

  // ---------------- instanced prototypes with per-instance LOD
  const PH = {}, PL = {};
  const collectProtos = (root, into) => root.traverse((o) => {
    if (!o.isMesh) return;
    const [pname] = o.name.split('__');
    o.geometry.computeVertexNormals();
    const m = o.material, kind = (m.userData || {}).kind || 'clay';
    if (KINDS[kind] !== undefined) patch(m, kind, m.userData || {});
    if (kind === 'snow') m.roughness = 0.75;
    o.updateMatrixWorld(true);
    (into[pname] = into[pname] || []).push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: m, snow: kind === 'snow' });
  });
  collectProtos(prot.scene, PH); collectProtos(protLo.scene, PL);
  const instGroups = [];
  const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = V(), _c4 = new THREE.Color();
  for (const [name, list] of Object.entries(meta.instances)) {
    if (!PH[name]) continue;
    const mk = (parts) => parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, list.length);
      im.castShadow = !name.startsWith('sleeper') && !name.startsWith('rock');
      im.receiveShadow = true; im.count = 0;
      if (!p.snow) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      scene.add(im); return im;
    });
    instGroups.push({ name, data: list.map(([x, y, z, rz, s, t]) => ({ p: V(x, y, z), rz, s, t })), hi: mk(PH[name]), lo: mk(PL[name] || PH[name]) });
  }
  const lodOrigin = V(1e9, 0, 0); const LOD_R = 70;
  function updateInstanceLOD(force) {
    const cp = camera.position;
    if (!force && cp.distanceTo(lodOrigin) < 3) return;
    lodOrigin.copy(cp);
    for (const g of instGroups) {
      let nh = 0, nl = 0;
      for (const d of g.data) {
        const hi = cp.distanceTo(d.p) < LOD_R;
        _q4.setFromAxisAngle(V(0, 1, 0), d.rz); _s4.setScalar(d.s); _m4.compose(d.p, _q4, _s4); _c4.setScalar(d.t);
        const set = hi ? g.hi : g.lo, k = hi ? nh++ : nl++;
        for (const im of set) { im.setMatrixAt(k, _m4); if (im.instanceColor) im.setColorAt(k, _c4); }
      }
      for (const im of g.hi) im.count = nh;
      for (const im of g.lo) im.count = nl;
      for (const im of g.hi.concat(g.lo)) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
    }
  }

  // ---------------- trains shuttle between the platforms and the tunnels
  const trains = [];
  for (const [route, r] of Object.entries(meta.routes)) {
    if (route.startsWith('road_')) continue;
    const curve = new THREE.CatmullRomCurve3(r.pts.map((p) => V(p[0], p[1] + 0.2, p[2])), false, 'centripetal');
    const parts = ['engine', 'car', 'car'].map((k) => {
      const grp = new THREE.Group(); grp.userData.route = route;
      for (const p of PH[`train_${route}_${k}`] || []) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; grp.add(m); }
      scene.add(grp); return grp;
    });
    trains.push({ route, curve, L: curve.getLength(), parts, phase: { red: 0, blue: 0.35, green: 0.7 }[route] });
  }
  function updateTrains(t) {
    for (const tr of trains) {
      const run = tr.L / 7.0, wait = 9, inTunnel = 5, period = 2 * run + wait + inTunnel;
      let u = ((t / period + tr.phase) % 1) * period, s, dir;
      const s0 = 9, s1 = tr.L + 14;
      if (tr.override != null) { s = tr.override; dir = 1; }
      else if (u < wait) { s = s0; dir = 1; } else if ((u -= wait) < run) { s = lerp(s0, s1, smooth(u / run)); dir = 1; }
      else if ((u -= run) < inTunnel) { s = s1; dir = -1; } else { u -= inTunnel; s = lerp(s1, s0, smooth(u / run)); dir = -1; }
      tr.parts.forEach((g, i) => {
        const si = s + (dir > 0 ? -i * 6.3 : i * 6.3), sk = clamp(si / tr.L, 0, 1);
        g.position.copy(tr.curve.getPointAt(Math.min(sk, 1)));
        const tg = tr.curve.getTangentAt(Math.min(sk, 0.999));
        g.rotation.set(0, Math.atan2(tg.x, tg.z) + (dir > 0 ? 0 : Math.PI) - Math.PI / 2, 0);
        g.visible = !feltNear && si < tr.L + 1.5;
      });
    }
  }

  // ---------------- lights
  const W2I = 1 / (4 * Math.PI);
  const hemi = new THREE.HemisphereLight(0x8a90c8, 0x5a4038, 0.4); scene.add(hemi);
  let keyLight;
  const villageLights = [], lamps = {}, outdoor = [];
  let interior = null;     // { lights: [...] } while the camera is inside a room set
  for (const Lg of meta.lights) {
    const col = new THREE.Color().fromArray(Lg.color), P = V(...Lg.pos);
    if (Lg.name === 'Key') {
      keyLight = new THREE.DirectionalLight(col, 2.6);
      keyLight.position.copy(P); keyLight.target.position.set(1.5, 1.5, 0);
      keyLight.castShadow = cfg.shadows; keyLight.shadow.mapSize.set(cfg.shadowMap, cfg.shadowMap);
      keyLight.shadow.radius = 5; keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.04;
      scene.add(keyLight, keyLight.target);
    } else if (Lg.name === 'Rim') { const d = new THREE.DirectionalLight(col, 1.4); d.position.copy(P); d.userData.base = 1.4; scene.add(d); outdoor.push(d); }
    else if (Lg.name === 'Fill') { const d = new THREE.DirectionalLight(col, 0.35); d.position.copy(P); d.userData.base = 0.35; scene.add(d); outdoor.push(d); }
    else if (Lg.type === 'POINT' || (Lg.type === 'AREA' && Lg.energy < 1000)) {
      const p = new THREE.PointLight(col, Lg.energy * W2I * (Lg.type === 'AREA' ? 0.22 : 0.45), Lg.type === 'AREA' ? 5 : 8, 2);
      p.position.copy(P);
      if (Lg.type === 'AREA') p.position.add(V(...Lg.dir).multiplyScalar(0.4));
      p.userData.base = p.intensity; p.name = Lg.name;
      if (/^Lamp(West|East)/.test(Lg.name)) lamps[Lg.name] = p;
      scene.add(p); villageLights.push(p);
    }
  }
  const treeGlow = new THREE.PointLight(0xffa860, 5, 22, 2); treeGlow.position.copy(B(5.5, -20, 6)); treeGlow.userData.base = 5; scene.add(treeGlow); villageLights.push(treeGlow);
  for (const [x, y, z, i] of [[6, -48, 5, 7], [-14, -48, 5, 6], [26, -52, 5, 6]]) {
    const p = new THREE.PointLight(0xffa860, i, 22, 2); p.position.copy(B(x, y, z)); p.userData.base = i; scene.add(p); villageLights.push(p);
  }

  // ---------------- snow + chimney smoke (around the viewer)
  const NF = cfg.snow, snowGeo = new THREE.BufferGeometry(), seed = new Float32Array(NF * 4);
  for (let i = 0; i < NF; i++) seed.set([Math.random() * 60 - 30, Math.random() * 14, Math.random() * 60 - 30, Math.random()], i * 4);
  snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
  snowGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uPx: { value: 800 }, uFocus: { value: 17 }, uAp: { value: 0.27 }, uC: { value: V() } },
    vertexShader: `attribute vec4 seed; uniform float uT, uPx, uFocus, uAp; uniform vec3 uC; varying float vA;
      void main(){ vec3 p = seed.xyz; p.y = mod(p.y - (1.0 + seed.w) * 1.2 * uT, 14.0) - 0.3;
        p.x += 0.2 * sin(uT * (0.6 + seed.w) + seed.w * 40.0); p.z += 0.1 * cos(uT * 0.5 + seed.w * 17.0);
        p.xz = uC.xz + mod(p.xz - uC.xz + 30.0, 60.0) - 30.0;
        bool inShop = p.x > -2.8 && p.x < 2.8 && p.z < 0.05 && p.z > -5.2 && p.y < 9.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float z = -mv.z; gl_Position = projectionMatrix * mv;
        float r = (0.008 + 0.016 * seed.w) * uPx / z; float coc = uAp * 0.036 * abs(z - uFocus) / (z * uFocus) * uPx * 25.0;
        float R = max(max(r, coc * 0.5), 0.7); vA = clamp((max(r, 0.7) / R) * (max(r, 0.7) / R), 0.03, 1.0) * 0.9;
        gl_PointSize = inShop || z < 0.15 ? 0.0 : min(2.0 * R, 90.0); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.75, d) * vA;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * 0.9, a); }`,
  });
  const snowPts = new THREE.Points(snowGeo, snowMat); snowPts.frustumCulled = false; scene.add(snowPts);
  const NS = 60, smokeGeo = new THREE.BufferGeometry(), sseed = new Float32Array(NS);
  for (let i = 0; i < NS; i++) sseed[i] = i / NS;
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  smokeGeo.setAttribute('s', new THREE.BufferAttribute(sseed, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uO: { value: V(...meta.chimney) }, uPx: { value: 800 } },
    vertexShader: `attribute float s; uniform float uT, uPx; uniform vec3 uO; varying float vA;
      void main(){ float a = fract(s + uT * 0.06); vec3 p = uO + vec3(0.6 * a + 0.15 * sin(a * 9.0 + s * 30.0), a * 3.2, -0.3 * a);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.25 + 1.3 * a) * uPx / -mv.z; vA = smoothstep(0.0, 0.12, a) * (1.0 - a) * 0.22; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(0.62, 0.56, 0.58, smoothstep(1.0, 0.0, d) * vA); }`,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);

  // ---------------- post
  let composer = null, bokeh = null, bloomPass = null;
  if (cfg.post) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera)); composer.addPass(sanitizePass());
    if (cfg.ao) { const ao = new GTAOPass(scene, camera, W(), H()); ao.blendIntensity = 0.8; composer.addPass(ao); }
    if (cfg.dof) { bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0006, maxblur: 0.006 }); composer.addPass(bokeh); }
    composer.addPass(sanitizePass());   // AO and depth of field can carry a bad pixel on; bloom would spread it
    bloomPass = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.22, 0.45, 0.92); composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  // ---------------- camera: pose, tweens, flights, explore
  const cur = { pos: V(), look: V(), fov: 46 };
  let move = null;                       // { kind, ..., resolve }
  function cancelMove(reason = 'cancelled') { if (move) { const r = move.resolve; move = null; r(reason); } }
  function setPose(p) { cancelMove(); cur.pos.copy(p.pos); cur.look.copy(p.look); cur.fov = p.fov ?? cur.fov; lodOrigin.set(1e9, 0, 0); }
  function tweenTo(p, dur = 2, ease = smoother) {
    cancelMove();
    if (dur <= 0) { setPose(p); return Promise.resolve('done'); }
    return new Promise((resolve) => { move = { kind: 'tween', t: 0, dur, ease, from: { pos: cur.pos.clone(), look: cur.look.clone(), fov: cur.fov }, to: p, resolve }; });
  }
  // keys: [[u, pos, look, fov], ...] with u in [0,1]
  function fly(keys, dur) {
    cancelMove();
    const pc = new THREE.CatmullRomCurve3(keys.map((k) => k[1].clone()), false, 'centripetal', 0.5);
    const lc = new THREE.CatmullRomCurve3(keys.map((k) => k[2].clone()), false, 'centripetal', 0.5);
    const at = (u) => {
      const e = smoother(u); let i = 0; while (i < keys.length - 2 && e > keys[i + 1][0]) i++;
      const k = clamp((e - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
      const ee = Math.min(e, 1 - 1e-6);   // getPointAt(1) can round past the curve's end and return nothing
      return { pos: pc.getPointAt(ee), look: lc.getPointAt(ee), fov: lerp(keys[i][3], keys[i + 1][3], smooth(k)) };
    };
    if (dur <= 0) { const f = at(1); setPose(f); return Promise.resolve('done'); }
    return new Promise((resolve) => { move = { kind: 'fly', t: 0, dur, at, resolve }; });
  }
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
  let exploreOpts = null;
  let exploreAsked = null;
  function explore(opts) {   // opts: { minDistance, maxDistance, maxPolar, box:[x0,x1,z0,z1] } or null to stop
    exploreAsked = opts;
    if (opts && baseHidden && baseHidden.explore) opts = { ...opts, ...baseHidden.explore };   // the felt look's storybook limits
    exploreOpts = opts;
    controls.enabled = !!opts;
    if (opts) {
      cancelMove();
      controls.minDistance = opts.minDistance ?? 2; controls.maxDistance = opts.maxDistance ?? 30;
      controls.maxPolarAngle = THREE.MathUtils.degToRad(opts.maxPolar ?? 84); controls.minPolarAngle = THREE.MathUtils.degToRad(opts.minPolar ?? 20);
      camera.position.copy(cur.pos); controls.target.copy(cur.look); controls.update();
    }
  }
  const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
  function springArm() {
    const dir = camera.position.clone().sub(controls.target); const L = dir.length(); dir.normalize();
    ray.set(controls.target, dir); ray.far = L;
    const h = ray.intersectObjects(collidables, false)[0];
    if (h && h.distance < L) camera.position.copy(controls.target).addScaledVector(dir, Math.max(0.3, h.distance - 0.25));
    if (camera.position.y < 0.45) camera.position.y = 0.45;
  }

  // ---------------- region light: clay dusk or the felt night (felt style test: felt_index.js lights)
  const clayLight = { bg: scene.background, fogNear: fogNear.clone(), fogFar: fogFar.clone(), sky: hemi.color.clone(), ground: hemi.groundColor.clone(),
    key: keyLight.color.clone(), outdoor: outdoor.map((d) => ({ d, c: d.color.clone(), base: d.userData.base })) };
  function regionLight(night) {
    scene.background = night ? nightSky : clayLight.bg;
    fogNear.copy(night ? new THREE.Color(0x161b36) : clayLight.fogNear); fogFar.copy(night ? new THREE.Color(0x1e2648) : clayLight.fogFar);
    hemi.color.copy(night ? new THREE.Color(0x6670b0) : clayLight.sky); hemi.groundColor.copy(night ? new THREE.Color(0x3a2a30) : clayLight.ground);
    keyLight.color.copy(night ? new THREE.Color(0xffd6a6) : clayLight.key);
    for (const o of clayLight.outdoor) {      // rim: cool blue moonlight, as in the felt test; fill unchanged
      const rim = o.base > 1; o.d.color.copy(night && rim ? new THREE.Color(0x9fb0ff) : o.c);
      o.d.userData.base = night && rim ? 0.9 : o.base; if (!interior) o.d.intensity = o.d.userData.base;
    }
    Object.assign(RL, night ? { exposure: 1.1, key: 2.3, hemiK: 1.15 } : { exposure: 1.25, key: 2.6, hemiK: 1 });
    if (!interior) keyLight.intensity = RL.key;
    renderer.toneMappingExposure = RL.exposure;
    if (bloomPass) bloomPass.strength = night ? 0.32 : 0.22;
  }

  // ---------------- scale-dependent atmosphere
  const VC = B(5, -12, 0);
  function atmosphere(alt, dist) {
    if (interior) {           // inside a room: no weather, no sky light, the room's own lamps
      scene.fog.density = 0.0; snowPts.visible = false; smoke.visible = false;
      for (const l of villageLights) l.visible = false;
      stat.scene.visible = false; statLo.scene.visible = true;
      if (bokeh) { bokeh.uniforms.focus.value = dist; bokeh.uniforms.aperture.value = 0.0009 * (host.dofBoost || 1); bokeh.uniforms.maxblur.value = 0.006; }
      return;
    }
    smoke.visible = true;
    const far = smooth((alt - 15) / 160);
    scene.fog.density = clamp(0.36 / Math.max(dist, 1), 0.0009, 0.018);
    scene.fog.color.copy(fogNear).lerp(fogFar, far);
    hemi.intensity = lerp(0.4, 0.55, far) * RL.hemiK;
    const size = clamp(dist * 0.75, 22, 300), sc = keyLight.shadow.camera;
    sc.left = -size; sc.right = size; sc.top = size * 0.8; sc.bottom = -size * 0.6; sc.near = 1; sc.far = 120 + size * 2.2; sc.updateProjectionMatrix();
    keyLight.target.position.copy(cur.look);
    keyLight.position.copy(cur.look).addScaledVector(V(-14, 13, 16).normalize(), 60 + size * 1.1);
    const vd = camera.position.distanceTo(VC);
    for (const l of villageLights) l.visible = vd < 130;
    const lo = vd > 150;
    const near = !!baseHidden && vd < 70;
    if (near !== feltNear) {             // crossing into / out of the felt world: swap the clay region and the light
      feltNear = near; terr.scene.visible = !near;
      for (const gI of instGroups) for (const im of gI.hi.concat(gI.lo)) im.visible = !near;
      applyLight();
    }
    stat.scene.visible = !lo && !feltNear; statLo.scene.visible = lo && !feltNear;
    if (feltNear) { const L = baseHidden.light; scene.fog.color.setHex(L.fog); scene.fog.density = L.fogDensity; hemi.intensity = L.hemi[2]; smoke.visible = false; }
    if (baseHidden) baseHidden.group.visible = feltNear;    // the felt hills and sky only belong down in the town
    if (textile) { for (const [l, c] of Object.entries(textile.corners)) c.group.visible = !lo && host.look === l; if (cornerClay) cornerClay.scene.visible = !lo && (host.look === 'clay' || host.look === 'felt'); }   // felt: the clay corner is the map-scale stand-in until the felt street fades in
    snowPts.visible = !feltNear && alt < 22 && dist < 45;
    if (bokeh) {
      bokeh.uniforms.focus.value = dist;
      bokeh.uniforms.aperture.value = lerp(0.0006, 0.00009, far) * (host.dofBoost || 1);
      bokeh.uniforms.maxblur.value = lerp(0.006, 0.004, far);
    }
  }

  // ---------------- picking + projection helpers for the DOM layers
  const _ndc = new THREE.Vector2();
  function pick(clientX, clientY, objects, far = 80) {
    const r = renderer.domElement.getBoundingClientRect();
    _ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(_ndc, camera); ray.far = far;
    return ray.intersectObjects(objects, true)[0] || null;
  }
  function project(p) {
    const v = p.clone().project(camera);
    return { x: (v.x + 1) / 2 * W(), y: (1 - v.y) / 2 * H(), inFront: v.z < 1 && v.z > -1 };
  }
  function occluded(p) {   // is anything solid between the camera and p?
    const d = p.clone().sub(camera.position), L = d.length();
    ray.set(camera.position, d.normalize()); ray.far = L - 0.35;
    return !!ray.intersectObjects(collidables, false)[0];
  }
  // never park the camera inside the set: if something solid sits between the target and the camera,
  // bring the camera in front of it (same idea as the explore spring-arm, for scripted shots)
  function clearPose(p) {
    const d = p.pos.clone().sub(p.look), L = d.length(); d.normalize();
    ray.set(p.look, d); ray.far = L;
    const h = ray.intersectObjects(collidables, false)[0];
    if (!h || h.distance >= L - 0.05) return p;
    return { ...p, pos: p.look.clone().addScaledVector(d, Math.max(0.8, h.distance - 0.35)) };
  }
  function groundAt(x, z, from = 6) {
    ray.set(V(x, from, z), V(0, -1, 0)); ray.far = from + 2;
    const h = ray.intersectObjects(collidables, false)[0];
    return h ? h.point.y : 0;
  }

  // ---------------- loop
  const updaters = new Set();
  let T = 0, last = performance.now(), running = false, paused = false;
  const perf = { ms: [] };
  function frame(dt) {
    T += dt; timeU.value = T;
    if (move) {
      move.t = clamp(move.t + dt / move.dur);
      const f = move.kind === 'tween'
        ? (() => { const e = move.ease(move.t); return { pos: move.from.pos.clone().lerp(move.to.pos, e), look: move.from.look.clone().lerp(move.to.look, e), fov: lerp(move.from.fov, move.to.fov ?? move.from.fov, e) }; })()
        : move.at(move.t);
      cur.pos.copy(f.pos); cur.look.copy(f.look); cur.fov = f.fov;
      if (move.t >= 1) { const r = move.resolve; move = null; r('done'); }
    }
    if (controls.enabled) {
      controls.update();
      if (exploreOpts && exploreOpts.box) {
        const b = exploreOpts.box, t = controls.target;
        t.x = clamp(t.x, b[0], b[1]); t.z = clamp(t.z, b[2], b[3]);
      }
      springArm(); cur.pos.copy(camera.position); cur.look.copy(controls.target);
    } else { camera.position.copy(cur.pos); camera.lookAt(cur.look); }
    setFovH(cur.fov);
    const alt = camera.position.y, dist = camera.position.distanceTo(cur.look);
    camera.near = clamp(dist * 0.004, 0.08, 2.0); camera.far = clamp(dist * 6, 300, 2500); camera.updateProjectionMatrix();
    atmosphere(alt, dist);
    updateInstanceLOD(false);
    updateTrains(T);
    for (const fn of updaters) fn(dt, T);
    const fl = 1 + 0.02 * Math.sin(T * 7.3) + 0.012 * Math.sin(T * 13.1);
    shopGlow.forEach((m) => { m.emissiveIntensity = 1.2 * fl; });
    const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    snowMat.uniforms.uT.value = T; snowMat.uniforms.uPx.value = px; snowMat.uniforms.uFocus.value = dist; snowMat.uniforms.uC.value.copy(cur.look);
    smokeMat.uniforms.uT.value = T; smokeMat.uniforms.uPx.value = px;
    renderer.info.reset();
    if (felt) {
      // down in the town (and not inside the shop) the felt street takes over; the map and the descent stay clay
      // only while the camera is looking at the felt street from nearby: the map, the station (the toy's send-off)
      // and the shop interior keep their own scenes
      const L = cur.look, onStreet = L.x > -13 && L.x < 16 && L.z > -7 && L.z < 10 && dist < 32;
      const want = host.look === 'felt' && !interior && onStreet ? 1 : 0;
      felt.mix = clamp(felt.mix + (want ? 1 : -1) * dt / 1.4);
      felt.update(T, dt);
      const k = smooth(felt.mix);
      if (k > 0) {
        // the journey's characters and story props are drawn into the felt street too
        for (const o of felt.shared) felt.scene.add(o);
        const tB = felt.render(dt, dist, k >= 1);
        for (const o of felt.shared) scene.add(o);
        if (k < 1) {
          renderer.toneMappingExposure = RL.exposure;
          let tA;
          if (composer) { composer.renderToScreen = false; composer.render(dt); tA = composer.readBuffer.texture; composer.renderToScreen = true; }
          else { renderer.setRenderTarget(felt.clayRT); renderer.render(scene, camera); renderer.setRenderTarget(null); tA = felt.clayRT.texture; }
          const u = felt.blend.material.uniforms; u.tA.value = tA; u.tB.value = tB; u.uK.value = k;
          renderer.toneMappingExposure = 1; renderer.render(felt.blendScene, felt.blendCam);
        }
        renderer.toneMappingExposure = RL.exposure;
        return;
      }
    }
    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }
  function start() {
    if (running) return; running = true; last = performance.now(); updateInstanceLOD(true);
    renderer.setAnimationLoop((now) => {
      if (paused) { last = now; return; }
      const dt = clamp((now - last) / 1000, 0, window.__dtMax || 0.1); last = now;
      frame(dt);
      perf.ms.push(dt * 1000); if (perf.ms.length > 90) perf.ms.shift();
    });
  }
  document.addEventListener('visibilitychange', () => { paused = document.hidden; });
  function resize() {
    camera.aspect = W() / H(); setFovH(fovH);
    renderer.setSize(W(), H()); composer && composer.setSize(W(), H());
    if (felt) { felt.setSize(W(), H()); felt.clayRT.setSize(W() * renderer.getPixelRatio(), H() * renderer.getPixelRatio()); }
  }
  addEventListener('resize', resize);

  const host = {
    THREE, scene, camera, renderer, meta, cfg, cur, collidables, villageLights, lamps, treeGlow, trains, door, bytes, load,
    setPose, tweenTo, fly, cancelMove, explore, controls, pick, project, occluded, groundAt, clearPose, ray,
    onUpdate: (fn) => { updaters.add(fn); return () => updaters.delete(fn); },
    start, frame, resize, setPaused: (v) => { paused = v; },
    get time() { return T; },
    // rooms (the toy shop interior) switch the outdoor lighting off and their own lamps on
    setInterior(room) {
      interior = room;
      keyLight.intensity = room ? 0 : (feltNear ? baseHidden.light.key[1] : RL.key); hemi.intensity = room ? 0.32 : 0.4;
      if (room) hemi.color.setRGB(1.0, 0.82, 0.66); else hemi.color.set(feltNear ? baseHidden.light.hemi[0] : 0x8a90c8);
      for (const d of outdoor) d.intensity = room ? 0 : d.userData.base;
      for (const l of host.roomLights) l.visible = !!room;
      lodOrigin.set(1e9, 0, 0);
    },
    get interior() { return interior; },
    roomLights: [],
    get moving() { return !!move; },
    fps: () => perf.ms.length ? 1000 / (perf.ms.reduce((s, x) => s + x, 0) / perf.ms.length) : 0,
    get composer() { return composer; },
    get feltMix() { return felt ? felt.mix : null; },   // 0 clay map … 1 felt street (tests)
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, tier: cfg.tier }),
    warm(poses) { for (const p of poses) { setPose(p); frame(1 / 60); } },
    dofBoost: 1,
    // ---- textile comparison (look !== null): which corner is showing, and a switch that keeps every interaction
    look: null,
    textile,
    // objects the journey adds that must also appear in the felt street (characters, story props)
    share(o) { pendingShare.add(o); if (felt) felt.shared.add(o); },
    onLook(fn) { lookListeners.add(fn); if (host.look) fn(host.look); return () => lookListeners.delete(fn); },
    setLook(l) {
      if (!textile || !['clay', 'textile', 'felt'].includes(l) || l === host.look) return;
      const prev = host.look; host.look = l;
      if (l === 'felt' && !feltTexU.value) feltTexU.value = feltTexture();
      feltU.value = l === 'felt' ? 1 : 0;
      regionLight(l === 'felt');   // the whole region (map, descent, station) re-skins as felt
      const on = l === 'clay' || l === 'felt' ? null : textile.ensure(l);   // felt: the clay set stays for the map; the felt street is its own scene
      for (const [k, c] of Object.entries(textile.corners)) { c.group.visible = k === l; c.door.visible = k === l; }
      cornerClay.scene.visible = l === 'clay' || l === 'felt';
      const fh = l === 'felt' ? textile.feltHouses() : feltHouses;
      if (fh) fh.group.visible = l === 'felt';
      if (housesClay) housesClay.scene.visible = l !== 'felt';
      for (const m of doorParts) m.visible = l === 'clay' || l === 'felt';
      // camera collision and ground probes follow whichever corner is showing
      const all = [...clayCornerMeshes, ...clayHouseMeshes, ...(feltHouses ? feltHouses.collide : []), ...Object.values(textile.corners).flatMap((c) => c.collide), ...(felt ? felt.collide : [])];
      const want = [...(on ? on.collide : l === 'felt' && felt ? felt.collide : clayCornerMeshes), ...(l === 'felt' ? feltHouses.collide : clayHouseMeshes)];
      for (const m of all) { const i = collidables.indexOf(m); if (i >= 0) collidables.splice(i, 1); }
      for (const m of want) collidables.push(m);
      const handmade = l === 'textile', wasHandmade = prev === 'textile';
      if (handmade && !wasHandmade) textile.unclothe = textile.ground.map((m) => textile.module.clothe(m, 'batt', 0xf7f4ee));
      if (!handmade && wasHandmade) { textile.unclothe.forEach((f) => f()); textile.unclothe = []; }
      // the felt look brings its own world (sky, hills, felt base) and its own night light; the others use the town's
      const st = null;
      if (!host._light) host._light = { hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(), key: keyLight.color.clone(), keyI: keyLight.intensity, exposure: renderer.toneMappingExposure, bg: scene.background };
      baseHidden = st || null;
      feltNear = false; terr.scene.visible = true;
      for (const gI of instGroups) for (const im of gI.hi.concat(gI.lo)) im.visible = true;
      applyLight();
      host.dofBoost = st ? st.dofBoost || 1 : 1;
      host.poses = l === 'felt' && felt ? felt.poses : null;   // the village uses the felt street's cameras in the felt look
      if (l === 'felt' && !felt && textile) makeFelt();         // built the first time Felt is chosen
      if (exploreAsked) explore(exploreAsked);
      for (const fn of lookListeners) fn(l);
    },
  };
  function applyLight() {       // the felt night only while the felt world is around the camera; the town's light otherwise
    const L0 = host._light, st = feltNear && baseHidden;
    if (!L0) return;
    if (st) { hemi.color.setHex(st.light.hemi[0]); hemi.groundColor.setHex(st.light.hemi[1]); keyLight.color.setHex(st.light.key[0]); keyLight.intensity = st.light.key[1]; renderer.toneMappingExposure = st.light.exposure; scene.background = new THREE.Color(st.light.background); }
    else { hemi.color.copy(L0.hemiSky); hemi.groundColor.copy(L0.hemiGround); keyLight.color.copy(L0.key); keyLight.intensity = L0.keyI; renderer.toneMappingExposure = L0.exposure; scene.background = L0.bg; }
  }
  hostRef = host;
  if (textile) host.setLook(['clay', 'felt'].includes(look) ? look : 'textile');
  if (textile) host.onUpdate(() => { for (const c of Object.values(textile.corners)) c.update(T); });
  onStatus('Ready', 1);
  return host;
}
