// Toy Town — map-scale experiment.
// One continuous world from a tabletop diorama of the countryside down to the
// clay village street.  Same scene, same lights, same materials at every scale.
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
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const Q = new URLSearchParams(location.search);
const ASSETS = window.TT_ASSETS || './assets/';
const ui = window.TT_UI || {};
const HEADLESS = Q.get('capture') || Q.get('audit') || Q.get('measure');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const B = (x, y, z = 0) => V(x, z, -y);              // Blender (x, y, z) -> three.js
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, k) => a + (b - a) * k;

// ------------------------------------------------------------------ renderer
const cfg = { post: Q.get('post') !== '0', shadows: Q.get('shadows') !== '0', snow: true, lod: Q.get('lod') !== '0', farLights: false, lampShadows: Q.get('lampshadows') === '1' };
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!HEADLESS });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.get('dpr') ? +Q.get('dpr') : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#0d0f20'); gr.addColorStop(0.55, '#262035'); gr.addColorStop(0.82, '#5a3c38'); gr.addColorStop(1, '#2a1c1c');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
const fogNear = new THREE.Color(0x2a2030), fogFar = new THREE.Color(0x2b3346);
scene.fog = new THREE.FogExp2(fogNear.clone(), 0.018);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.2, 2500);
let fovH = 45;
function setFovH(h) {
  fovH = h;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect));
  camera.updateProjectionMatrix();
}

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
function patch(mat, kind, extras = {}, local = false) {
  const c2 = extras.color2 ? new THREE.Color().fromArray(extras.color2) : null;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKind = { value: KINDS[kind] ?? 0 };
    sh.uniforms.uC2 = { value: c2 || new THREE.Color(1, 1, 1) };
    sh.uniforms.uT = timeU;
    const src = local ? 'vec4(position, 1.0)' : '(modelMatrix * vec4(transformed, 1.0))';
    const srcI = local ? 'vec4(position, 1.0)' : '(modelMatrix * instanceMatrix * vec4(transformed, 1.0))';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n#ifdef USE_INSTANCING\nvWPos = ${srcI}.xyz;\n#else\nvWPos = ${src}.xyz;\n#endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform int uKind; uniform vec3 uC2; uniform float uT;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uKind == 4) {            // painted plaster landscape: brush mottling at diorama scale
          float m = fbm(vWPos * 0.09) * 0.6 + fbm(vWPos * 0.6) * 0.4;
          diffuseColor.rgb *= 0.82 + 0.36 * m;
        } else {
          float drift = fbm(vWPos * 0.9);
          if (uKind == 2) { float st = step(0.5, fract((vWPos.x + 0.025*fbm(vWPos*4.0)) / 0.64)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, st); }
          diffuseColor.rgb *= uKind == 3 ? 0.92 + 0.16 * drift : 0.86 + 0.28 * drift;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h, amp;
          if (uKind == 4) { h = 0.8*cells(vWPos*0.35 + fbm(vWPos*0.08)) + 0.7*fbm(vWPos*1.4) + 0.25*fbm(vWPos*6.0); amp = 0.18; }
          else if (uKind == 5) { h = fbm(vWPos*vec3(0.6,0.6,0.6) + vec3(uT*0.15, 0.0, uT*0.08)) + 0.4*fbm(vWPos*2.3 - uT*0.2); amp = 0.06; }
          else if (uKind == 1) { h = -0.9*cells(vWPos*11.0) - 0.35*cells(vWPos*34.0) + 0.6*fbm(vWPos*6.0); amp = 0.035; }
          else if (uKind == 3) { h = 0.5*fbm(vWPos*60.0) + 0.5*fbm(vWPos*160.0) + 0.4*cells(vWPos*9.0); amp = 0.006; }
          else { h = 0.9*cells(vWPos*3.5 + fbm(vWPos*1.2)) + 0.6*fbm(vWPos*7.0) + 0.15*fbm(vWPos*90.0); amp = 0.025; }
          // fade fine detail out with distance so it never shimmers from far away
          float far = clamp(length(vViewPosition) / (uKind == 4 ? 900.0 : 160.0), 0.0, 1.0);
          amp *= 1.0 - 0.85 * far;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(h)*amp, dhy = dFdy(h)*amp;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  mat.customProgramCacheKey = () => 'tt-' + kind + (local ? '-l' : '');
}
const timeU = { value: 0 };

// ------------------------------------------------------------------ load
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function loadGLB(name) {
  const b64 = window.TT_B64 && window.TT_B64[name];
  if (b64) {
    const txt = await (await fetch(b64)).text();
    return loader.parseAsync(Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0)).buffer, '');
  }
  return loader.loadAsync(ASSETS + name);
}
ui.status && ui.status('Laying out the countryside…');
const meta = await (await fetch(ASSETS + 'region.json')).json();
const [stat, statLo, terr, prot, protLo, mg] = await Promise.all(
  ['static.glb', 'static_lo.glb', 'terrain.glb', 'protos.glb', 'protos_lo.glb', 'marine.glb'].map(loadGLB));

const doorParts = [], shopGlow = [], collidables = [];
function prepStatic(root, isLo) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeVertexNormals();
    const m = o.material, ex = m.userData || {}, kind = ex.kind || 'clay';
    if (kind === 'ice') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.1; }
    if (KINDS[kind] !== undefined) patch(m, kind, ex);
    if (kind === 'snow') { m.roughness = 0.75; m.color.multiplyScalar(1.05); }
    if (kind === 'water') { m.roughness = 0.12; m.metalness = 0.0; m.envMapIntensity = 1; }
    if (m.emissiveIntensity > 0) { if (m.name.includes('ShopGlow')) shopGlow.push(m); m.emissiveIntensity *= 0.6; }
    o.castShadow = !['glow', 'emissive', 'water'].includes(kind) && !/GroundSnow|Table|BoardEdge/.test(o.name);
    o.receiveShadow = true;
    if (!isLo) { if (o.name.startsWith('door_')) doorParts.push(o); else collidables.push(o); }
  });
}
prepStatic(stat.scene, false); prepStatic(statLo.scene, true);
scene.add(stat.scene, statLo.scene);
statLo.scene.visible = false;
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
for (const m of collidables) m.geometry.computeBoundsTree();

// ------------------------------------------------------------------ instanced prototypes with per-instance LOD
const protoMeshes = {};   // name -> [{geo, mat}] (hi), lo
function collectProtos(root, into) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const [pname] = o.name.split('__');
    o.geometry.computeVertexNormals();
    const m = o.material, kind = (m.userData || {}).kind || 'clay';
    if (KINDS[kind] !== undefined) patch(m, kind, m.userData || {});
    if (kind === 'snow') { m.roughness = 0.75; }
    o.updateMatrixWorld(true);
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    (into[pname] = into[pname] || []).push({ geo: g, mat: m, snow: kind === 'snow' });
  });
}
const PH = {}, PL = {};
collectProtos(prot.scene, PH); collectProtos(protLo.scene, PL);
const instGroups = [];   // {name, data:[...], hi:[InstancedMesh], lo:[InstancedMesh]}
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
  const gI = { name, data: list.map(([x, y, z, rz, s, t]) => ({ p: V(x, y, z), rz, s, t })), hi: mk(PH[name]), lo: mk(PL[name] || PH[name]) };
  instGroups.push(gI);
}
let lodOrigin = V(1e9, 0, 0), LOD_R = 70;
function updateInstanceLOD(force) {
  const cp = camera.position;
  if (!force && cp.distanceTo(lodOrigin) < 3) return;
  lodOrigin.copy(cp);
  for (const g of instGroups) {
    let nh = 0, nl = 0;
    for (const d of g.data) {
      const hi = !cfg.lod || cp.distanceTo(d.p) < LOD_R;
      _q4.setFromAxisAngle(V(0, 1, 0), d.rz); _s4.setScalar(d.s);
      _m4.compose(d.p, _q4, _s4);
      _c4.setScalar(d.t);
      const set = hi ? g.hi : g.lo, k = hi ? nh++ : nl++;
      for (const im of set) { im.setMatrixAt(k, _m4); if (im.instanceColor) im.setColorAt(k, _c4); }
    }
    for (const im of g.hi.concat(g.lo)) { im.count = im === g.hi[0] || g.hi.includes(im) ? nh : nl; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  }
}

// ------------------------------------------------------------------ trains shuttle between the platforms and the tunnels
const trains = [];
for (const [route, r] of Object.entries(meta.routes)) {
  if (route.startsWith('road_')) continue;
  const curve = new THREE.CatmullRomCurve3(r.pts.map((p) => V(p[0], p[1] + 0.2, p[2])), false, 'centripetal');
  const parts = ['engine', 'car', 'car'].map((k) => {
    const gname = `train_${route}_${k}`;
    const grp = new THREE.Group();
    for (const p of PH[gname] || []) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; grp.add(m); }
    scene.add(grp); return grp;
  });
  trains.push({ route, curve, L: curve.getLength(), parts, phase: { red: 0, blue: 0.35, green: 0.7 }[route] });
}
function trainS(tr, t) {   // ping-pong: wait in the station, run out to the tunnel, wait inside, come back
  const run = tr.L / 7.0, wait = 9, inTunnel = 5, period = 2 * run + wait + inTunnel;
  let u = ((t / period + tr.phase) % 1) * period;
  const s0 = 9, s1 = tr.L + 14;
  if (u < wait) return { s: s0, dir: 1 };
  u -= wait;
  if (u < run) return { s: lerp(s0, s1, smooth(u / run)), dir: 1 };
  u -= run;
  if (u < inTunnel) return { s: s1, dir: -1 };
  u -= inTunnel;
  return { s: lerp(s1, s0, smooth(u / run)), dir: -1 };
}
function updateTrains(t) {
  for (const tr of trains) {
    const { s, dir } = trainS(tr, t);
    tr.parts.forEach((g, i) => {
      const sk = clamp((s + (dir > 0 ? -i * 6.3 : i * 6.3)) / tr.L, 0, 1);
      const p = tr.curve.getPointAt(Math.min(sk, 1)), tg = tr.curve.getTangentAt(Math.min(sk, 0.999));
      g.position.copy(p);
      const yaw = Math.atan2(tg.x, tg.z) + (dir > 0 ? 0 : Math.PI) - Math.PI / 2;
      g.rotation.set(0, yaw, 0);
      g.visible = s + (dir > 0 ? -i * 6.3 : i * 6.3) < tr.L + 1.5;   // hidden once inside the tunnel
    });
  }
}

// ------------------------------------------------------------------ lights
const W2I = 1 / (4 * Math.PI);
const hemi = new THREE.HemisphereLight(0x8a90c8, 0x5a4038, 0.4); scene.add(hemi);
let keyLight;
const villageLights = [];
for (const Lg of meta.lights) {
  const col = new THREE.Color().fromArray(Lg.color), P = V(...Lg.pos);
  if (Lg.name === 'Key') {
    keyLight = new THREE.DirectionalLight(col, 2.6);
    keyLight.position.copy(P); keyLight.target.position.set(1.5, 1.5, 0);
    keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.radius = 5; keyLight.shadow.bias = -0.0004; keyLight.shadow.normalBias = 0.04;
    scene.add(keyLight, keyLight.target);
  } else if (Lg.name === 'Rim') { const d = new THREE.DirectionalLight(col, 1.4); d.position.copy(P); scene.add(d); }
  else if (Lg.name === 'Fill') { const d = new THREE.DirectionalLight(col, 0.35); d.position.copy(P); scene.add(d); }
  else if (Lg.type === 'POINT' || (Lg.type === 'AREA' && Lg.energy < 1000)) {
    const p = new THREE.PointLight(col, Lg.energy * W2I * (Lg.type === 'AREA' ? 0.22 : 0.45), Lg.type === 'AREA' ? 5 : 8, 2);
    p.position.copy(P);
    if (Lg.type === 'AREA') p.position.add(V(...Lg.dir).multiplyScalar(0.4));
    if (Lg.name.startsWith('LampWest') || Lg.name.startsWith('LampEast')) { p.castShadow = true; p.userData.lamp = true; p.shadow.mapSize.set(512, 512); p.shadow.bias = -0.002; }
    scene.add(p); villageLights.push(p);
  }
}
// the station's warm interior and the square tree glow, visible from the approach
for (const [x, y, z, i] of [[6, -48, 5, 7], [-14, -48, 5, 6], [26, -52, 5, 6], [5.5, -20, 6, 5]]) {
  const p = new THREE.PointLight(0xffa860, i, 22, 2); p.position.copy(B(x, y, z)); scene.add(p); villageLights.push(p);
}

// ------------------------------------------------------------------ Marines in the square
const STRIDE = 1.3;
function makeMarine(colors, carry) {
  const obj = skClone(mg.scene);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => { const c = m.clone(); if (colors && colors[m.name]) c.color.set(colors[m.name]); patch(c, /Coat|Trouser/.test(m.name) ? 'felt' : 'clay', {}, true); return c; });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  scene.add(obj);
  const mixer = new THREE.AnimationMixer(obj);
  const clip = mg.animations.find((c) => c.name === (carry ? 'WalkCarry' : 'Walk'));
  const act = mixer.clipAction(clip); act.play();
  return { obj, mixer, act };
}
const marines = [
  { M: makeMarine(null, false), path: new THREE.CatmullRomCurve3([[-9, -12], [0, -10.5], [14, -11], [19, -18], [14, -27], [0, -28.5], [-8, -24], [-10, -17]].map(([x, y]) => B(x, y, 0.08)), true), v: 1.0, s0: 0 },
  { M: makeMarine({ rt_MarineSkin: 0x8a5a3c, rt_MarineCheek: 0x9a5848, rt_MarineHair: 0x1a120e }, false),
    path: new THREE.CatmullRomCurve3([[-12, -3.4], [0, -4.0], [12, -3.6], [20, -7], [12, -9.5], [0, -9.0], [-11, -8.5], [-15, -5.5]].map(([x, y]) => B(x, y, 0.08)), true), v: 0.9, s0: 10 },
];
marines.forEach((m) => { m.L = m.path.getLength(); });
let stopMotion = true;
function updateMarines(t) {
  const tc = stopMotion ? Math.floor(t * 12) / 12 : t;
  for (const m of marines) {
    const s = (((m.s0 + tc * m.v) % m.L) + m.L) % m.L, u = clamp(s / m.L, 0, 1);
    const p = m.path.getPointAt(u), tg = m.path.getTangentAt(u);
    m.M.obj.position.copy(p); m.M.obj.rotation.set(0, Math.atan2(tg.x, tg.z), 0);
    const d = m.M.act.getClip().duration;
    m.M.act.time = ((m.s0 + tc * m.v) / STRIDE % 1) * d; m.M.mixer.update(0);
  }
}

// ------------------------------------------------------------------ snow + smoke (around the viewer)
const NF = 6000, snowGeo = new THREE.BufferGeometry(), seed = new Float32Array(NF * 4);
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
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0;
      gl_FragColor = vec4(0.62, 0.56, 0.58, smoothstep(1.0, 0.0, d) * vA); }`,
});
const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);

// ------------------------------------------------------------------ post
let composer, bokeh;
function buildPost() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight); ao.blendIntensity = 0.8; composer.addPass(ao);
  bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0006, maxblur: 0.006 }); composer.addPass(bokeh);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 0.92));
  composer.addPass(new OutputPass());
}
buildPost();

// ------------------------------------------------------------------ cameras: three distances + one continuous flight
const VILLAGE = meta.cameras.Hero;
const VIEWS = {
  map: { pos: B(30, -275, 175), look: B(8, -2, 0), fov: 46 },
  approach: { pos: B(30, -58, 27), look: B(3, -11, 2.5), fov: 48 },
  village: { pos: V(...VILLAGE.pos), look: V(...VILLAGE.target), fov: VILLAGE.fov_h },
};
// the flight: high over the board, around the station's east side, over the square, down to the street
const FLIGHT = [
  [0.00, VIEWS.map.pos, VIEWS.map.look, 46],
  [0.30, B(42, -165, 95), B(6, -12, 0.5), 47],
  [0.55, B(46, -96, 40), B(3, -16, 3), 47],
  [0.70, VIEWS.approach.pos, VIEWS.approach.look, 48],
  [0.81, B(19, -41, 18.5), B(2, -8, 3.2), 49],      // clear of the head house roof and the clock tower
  [0.91, B(3, -27, 9.5), B(1.5, -3, 3.4), 51],
  [1.00, VIEWS.village.pos, VIEWS.village.look, VIEWS.village.fov],
];
const posCurve = new THREE.CatmullRomCurve3(FLIGHT.map((k) => k[1].clone()), false, 'centripetal', 0.5);
const lookCurve = new THREE.CatmullRomCurve3(FLIGHT.map((k) => k[2].clone()), false, 'centripetal', 0.5);
const FLIGHT_S = 13.0;
function flightAt(u) {   // u in [0,1] -> eased pose; speed eases in, settles slowly at street level
  const e = smoother(u);
  const pos = posCurve.getPointAt(e), look = lookCurve.getPointAt(e);
  let i = 0; while (i < FLIGHT.length - 2 && e > FLIGHT[i + 1][0]) i++;
  const k = clamp((e - FLIGHT[i][0]) / (FLIGHT[i + 1][0] - FLIGHT[i][0]));
  return { pos, look, fov: lerp(FLIGHT[i][3], FLIGHT[i + 1][3], smooth(k)) };
}
let mode = 'map', flight = null, tween = null;
const cur = { pos: VIEWS.map.pos.clone(), look: VIEWS.map.look.clone(), fov: 44 };
function goView(name) { flight = null; const v = VIEWS[name]; tween = { t: 0, from: { pos: cur.pos.clone(), look: cur.look.clone(), fov: cur.fov }, to: v, dur: 3.0 }; mode = name; exploring(false); }
function enterTown() { exploring(false); tween = null; flight = { u: 0, dir: 1 }; if (mode !== 'map') { cur.pos.copy(VIEWS.map.pos); } mode = 'flying'; }
function returnToMap() { exploring(false); tween = null; flight = { u: 1, dir: -1 }; mode = 'flying'; }

// explore mode: free orbit with a spring arm so the camera stays out of walls and hills
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 1.0; controls.maxDistance = 520; controls.maxPolarAngle = THREE.MathUtils.degToRad(87);
let explore = false;
function exploring(on) { explore = on; controls.enabled = on; if (on) { controls.target.copy(cur.look); } }
const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
function springArm() {
  const dir = camera.position.clone().sub(controls.target); const L = dir.length(); dir.normalize();
  ray.set(controls.target, dir); ray.far = L;
  const h = ray.intersectObjects(collidables, false)[0];
  if (h && h.distance < L) camera.position.copy(controls.target).addScaledVector(dir, Math.max(0.3, h.distance - 0.25));
}

// ------------------------------------------------------------------ scale-dependent atmosphere
const VC = B(5, -12, 0);
function atmosphere(alt, dist) {
  const far = smooth((alt - 15) / 160);
  // fog scaled to what we look at: a soft veil, never a wall, at every distance
  scene.fog.density = clamp(0.36 / Math.max(dist, 1), 0.0009, 0.018);
  scene.fog.color.copy(fogNear).lerp(fogFar, far);
  hemi.intensity = lerp(0.4, 0.55, far);
  hemi.color.setRGB(lerp(0.54, 0.5, far), lerp(0.56, 0.6, far), lerp(0.78, 0.86, far));
  // shadows: frustum hugs what we are looking at, so they stay crisp at every scale
  const size = clamp(dist * 0.75, 22, 300);
  const sc = keyLight.shadow.camera;
  sc.left = -size; sc.right = size; sc.top = size * 0.8; sc.bottom = -size * 0.6; sc.near = 1; sc.far = 120 + size * 2.2;
  sc.updateProjectionMatrix();
  const dirK = V(-14, 13, 16).normalize();
  keyLight.target.position.copy(cur.look);
  keyLight.position.copy(cur.look).addScaledVector(dirK, 60 + size * 1.1);
  keyLight.castShadow = cfg.shadows;
  // village practical lights only matter up close (and cost every pixel): fade, then switch off
  const vd = camera.position.distanceTo(VC);
  const on = cfg.farLights || vd < 130;
  for (const l of villageLights) { l.visible = on; }
  // the whole static village swaps to its light-weight version from far away
  const lo = cfg.lod && vd > 150;
  stat.scene.visible = !lo; statLo.scene.visible = lo;
  snowPts.visible = cfg.snow && alt < 22 && dist < 45;
  // lamppost cube shadows (6 extra renders each) only where they can be seen
  for (const l of villageLights) if (l.userData.lamp) l.castShadow = cfg.shadows && cfg.lampShadows && vd < 45;
  // miniature depth of field: the board reads as a model from above
  if (bokeh) {
    bokeh.uniforms.focus.value = dist;
    bokeh.uniforms.aperture.value = lerp(0.0006, 0.00009, far);
    bokeh.uniforms.maxblur.value = lerp(0.006, 0.004, far);
  }
}

// ------------------------------------------------------------------ main loop
let T = 0, last = performance.now(), doorOpen = 0, doorTarget = 0;
const perf = { ms: [] };
function frame(dt) {
  T += dt; timeU.value = T;
  if (flight) {
    flight.u = clamp(flight.u + flight.dir * dt / FLIGHT_S);
    const f = flightAt(flight.u);
    cur.pos.copy(f.pos); cur.look.copy(f.look); cur.fov = f.fov;
    if ((flight.dir > 0 && flight.u >= 1) || (flight.dir < 0 && flight.u <= 0)) { mode = flight.dir > 0 ? 'village' : 'map'; flight = null; ui.arrived && ui.arrived(mode); }
  } else if (tween) {
    tween.t = clamp(tween.t + dt / tween.dur); const e = smoother(tween.t);
    cur.pos.lerpVectors(tween.from.pos, tween.to.pos, e); cur.look.lerpVectors(tween.from.look, tween.to.look, e);
    cur.fov = lerp(tween.from.fov, tween.to.fov, e);
    if (tween.t >= 1) tween = null;
  }
  if (explore) { controls.update(); springArm(); cur.pos.copy(camera.position); cur.look.copy(controls.target); }
  else { camera.position.copy(cur.pos); camera.lookAt(cur.look); }
  setFovH(cur.fov);
  const alt = camera.position.y, dist = camera.position.distanceTo(cur.look);
  camera.near = clamp(dist * 0.004, 0.15, 2.0); camera.far = clamp(dist * 6, 300, 2500); camera.updateProjectionMatrix();
  atmosphere(alt, dist);
  updateInstanceLOD(false);
  updateTrains(T); updateMarines(T);
  doorOpen += (doorTarget - doorOpen) * Math.min(1, dt * 2.2);
  door.rotation.y = THREE.MathUtils.degToRad(104) * doorOpen * doorOpen * (3 - 2 * doorOpen);
  const fl = 1 + 0.02 * Math.sin(T * 7.3) + 0.012 * Math.sin(T * 13.1);
  shopGlow.forEach((m) => { m.emissiveIntensity = 1.2 * fl * (1 + 0.4 * doorOpen); });
  const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  snowMat.uniforms.uT.value = T; snowMat.uniforms.uPx.value = px; snowMat.uniforms.uFocus.value = dist; snowMat.uniforms.uC.value.copy(cur.look);
  smokeMat.uniforms.uT.value = T; smokeMat.uniforms.uPx.value = px;
  renderer.info.reset();
  if (cfg.post) composer.render(dt); else renderer.render(scene, camera);
}

// door: click it at street level
const mouse = new THREE.Vector2();
const doorMeshes = []; door.traverse((o) => o.isMesh && doorMeshes.push(o));
renderer.domElement.addEventListener('click', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera); ray.far = 60;
  if (ray.intersectObjects(doorMeshes, false).length) doorTarget = doorTarget ? 0 : 1;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; setFovH(fovH);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ measurement
function memoryReport() {
  let geoBytes = 0, instBytes = 0; const seen = new Set();
  scene.traverse((o) => {
    if (!o.geometry || seen.has(o.geometry)) return; seen.add(o.geometry);
    for (const a of Object.values(o.geometry.attributes)) geoBytes += a.array.byteLength;
    if (o.geometry.index) geoBytes += o.geometry.index.array.byteLength;
    if (o.isInstancedMesh) { instBytes += o.instanceMatrix.array.byteLength + (o.instanceColor ? o.instanceColor.array.byteLength : 0); }
  });
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const rtBytes = cfg.post ? w * h * (8 * 3 + 4 * 2) : w * h * 8;    // composer targets (half-float) + AO/DOF buffers, approx
  const shadow = 2048 * 2048 * 4 + 2 * 6 * 512 * 512 * 4;
  return { geometryMB: geoBytes / 1048576, instancesMB: instBytes / 1048576, renderTargetsMB: rtBytes / 1048576, shadowMapsMB: shadow / 1048576,
           jsHeapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null, programs: renderer.info.programs?.length };
}
function snapshot(viewName) {
  const v = VIEWS[viewName]; flight = null; tween = null; explore = false;
  cur.pos.copy(v.pos); cur.look.copy(v.look); cur.fov = v.fov; lodOrigin.set(1e9, 0, 0);
}
async function measure(frames = 90, report) {
  const rows = [];
  const configs = [['full', {}], ['no snow', { snow: false }], ['no shadows', { shadows: false }], ['no effects', { post: false }],
                   ['no LOD', { lod: false }], ['village lights always on', { farLights: true }], ['lamp shadows on', { lampShadows: true }]];
  const base = { ...cfg };
  for (const view of ['map', 'approach', 'village']) {
    for (const [label, over] of configs) {
      Object.assign(cfg, base, over);
      snapshot(view);
      const gl = renderer.getContext(), px = new Uint8Array(4);
      for (let i = 0; i < 3; i++) frame(1 / 60);
      const ms = []; let calls = 0, tris = 0;
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now(); frame(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        ms.push(performance.now() - t0); calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      ms.sort((a, b) => a - b);
      const avg = ms.reduce((s, x) => s + x, 0) / ms.length;
      const row = { view, config: label, avgMs: +avg.toFixed(1), fps: +(1000 / avg).toFixed(1), p95Ms: +ms[Math.floor(ms.length * 0.95)].toFixed(1), drawCalls: calls, triangles: tris };
      rows.push(row); report && report(row);
    }
  }
  Object.assign(cfg, base);
  let gpu = 'unknown';
  try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch (e) {}
  return { rows, memory: memoryReport(), gpu, canvas: renderer.domElement.width + 'x' + renderer.domElement.height };
}

// ------------------------------------------------------------------ API + modes
const API = {
  views: Object.keys(VIEWS), goView, enterTown, returnToMap, explore: exploring, get mode() { return mode; },
  set: (k, v) => { cfg[k] = v; lodOrigin.set(1e9, 0, 0); }, stopMotion: (v) => { stopMotion = v; },
  toggleDoor: () => { doorTarget = doorTarget ? 0 : 1; }, measure, memory: memoryReport,
  counts: () => ({ static: meta.triangles, instances: Object.fromEntries(Object.entries(meta.instances).map(([k, v]) => [k, v.length])) }),
};
window.TT = API;
for (const name of ['village', 'map']) { snapshot(name); atmosphere(camera.position.y, 1); renderer.compile(scene, camera); }  // warm both light setups

if (Q.get('capture')) {
  window.__shot = (spec, w, h) => {
    if (w) { renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; }
    if (typeof spec === 'number') { flight = { u: spec, dir: 0 }; const f = flightAt(spec); cur.pos.copy(f.pos); cur.look.copy(f.look); cur.fov = f.fov; flight = null; }
    else snapshot(spec);
    lodOrigin.set(1e9, 0, 0);
    for (let i = 0; i < 2; i++) frame(1 / 24);
    return { png: renderer.domElement.toDataURL('image/jpeg', 0.92), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  window.__ready = true;
} else if (Q.get('audit')) {
  const out = []; let worst = { d: Infinity };
  for (let u = 0; u <= 1.0001; u += 0.005) {
    const f = flightAt(u); let best = Infinity;
    for (let i = 0; i < 26; i++) {
      const y = 1 - (i + 0.5) / 26 * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      ray.set(f.pos, V(Math.cos(th) * r, y, Math.sin(th) * r)); ray.far = 6;
      const hit = ray.intersectObjects(collidables, false)[0]; if (hit) best = Math.min(best, hit.distance);
    }
    out.push([+u.toFixed(3), +best.toFixed(2), +f.pos.y.toFixed(1)]);
    if (best < worst.d) worst = { d: best, u, pos: f.pos.toArray().map((v) => +v.toFixed(1)) };
  }
  window.__audit = { worst, samples: out }; window.__ready = true;
} else if (Q.get('measure')) {
  window.__measure = measure; window.__ready = true;
} else {
  ui.ready && ui.ready(API);
  updateInstanceLOD(true);
  renderer.setAnimationLoop((now) => {
    const dt = clamp((now - last) / 1000, 0, 0.1); last = now;
    frame(dt);
    perf.ms.push(dt * 1000); if (perf.ms.length > 120) perf.ms.shift();
    ui.tick && ui.tick({ fps: 1000 / (perf.ms.reduce((s, x) => s + x, 0) / perf.ms.length), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, mode, alt: camera.position.y });
  });
}
