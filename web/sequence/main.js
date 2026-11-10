// Toy Town — "The Delivery": a short interactive stop-motion sequence.
//
// Everything on screen is a pure function of sequence time `T`, so play, pause,
// scrub and replay are exact.  Characters, the present and the door advance
// "on twos" (12 poses a second, like a stop-motion puppet); the camera glides
// smoothly like a motion-control rig.
//
//   characters : two skinned clay Marines, four blended clips (walk / walk carrying /
//                idle / idle carrying), walk phase locked to distance travelled
//   hands      : two-bone IK onto the present, cap brim, wave and door knob
//   present    : a separate prop; hands lock to it, it never parents to a bone mid-move
//   camera     : blended "shots" from a virtual cinematographer, clearance-tested
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
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const Q = new URLSearchParams(location.search);
const ASSETS = window.TT_ASSETS || './assets/';
const STILL = Q.get('still') || Q.get('capture');   // headless: render frames for review
const AUDIT = Q.get('audit');           // headless: camera clearance audit
const ui = window.TT_UI || {};          // page hooks (optional)
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const B = (x, y, z = 0) => V(x, z, -y);              // Blender (x, y, z) -> three.js
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;

// ------------------------------------------------------------------ renderer
let postOn = Q.get('post') !== '0';
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!STILL });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.get('dpr') ? +Q.get('dpr') : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#0e1022'); gr.addColorStop(0.55, '#2c2238'); gr.addColorStop(0.8, '#7a4a3c'); gr.addColorStop(1, '#3a2522');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
scene.fog = new THREE.FogExp2(0x2a2030, 0.018);
const meta = await (await fetch(ASSETS + 'scene.json')).json();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.2, 300);
let fovH = 40;
function setFovH(h) {
  fovH = h;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect));
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ handcrafted surface patch
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
function patch(mat, kind, extras = {}, local = false) {
  const c2 = extras.color2 ? new THREE.Color().fromArray(extras.color2) : null;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKind = { value: { clay: 0, wood: 0, cobble: 0, snow: 1, fabric: 2, felt: 3 }[kind] ?? 0 };
    sh.uniforms.uC2 = { value: c2 || new THREE.Color(1, 1, 1) };
    // characters use their bind-pose position so the texture sticks to the moving puppet
    const src = local ? 'vec4(position, 1.0)' : '(modelMatrix * vec4(transformed, 1.0))';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWPos = ${src}.xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform int uKind; uniform vec3 uC2;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float drift = fbm(vWPos * 0.9);
        if (uKind == 2) { float st = step(0.5, fract((vWPos.x + 0.025*fbm(vWPos*4.0)) / 0.64)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, st); }
        diffuseColor.rgb *= uKind == 3 ? 0.92 + 0.16 * drift : 0.86 + 0.28 * drift;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h;
          if (uKind == 1) h = -0.9*cells(vWPos*11.0) - 0.35*cells(vWPos*34.0) + 0.6*fbm(vWPos*6.0);
          else if (uKind == 3) h = 0.5*fbm(vWPos*60.0) + 0.5*fbm(vWPos*160.0) + 0.4*cells(vWPos*9.0);
          else h = 0.9*cells(vWPos*3.5 + fbm(vWPos*1.2)) + 0.6*fbm(vWPos*7.0) + 0.15*fbm(vWPos*90.0);
          float amp = uKind == 1 ? 0.035 : (uKind == 3 ? 0.006 : 0.025);
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
ui.status && ui.status('Building the village…');
const [world, mg, gg] = await Promise.all([loadGLB('toytown_seq.glb'), loadGLB('marine.glb'), loadGLB('gift.glb')]);
const root = world.scene;
let tris = 0;
const doorParts = [], shopGlow = [], staticMeshes = [];
root.traverse((o) => {
  if (!o.isMesh) return;
  o.geometry.computeVertexNormals();
  tris += o.geometry.index ? o.geometry.index.count / 3 : 0;
  const m = o.material, ex = m.userData || {}, kind = ex.kind || 'clay';
  if (kind === 'ice') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.1; }
  if (['clay', 'snow', 'wood', 'cobble', 'fabric'].includes(kind)) patch(m, kind, ex);
  if (kind === 'snow') { m.roughness = 0.75; m.color.multiplyScalar(1.05); }
  if (m.emissiveIntensity > 0 && m.name.includes('ShopGlow')) shopGlow.push(m);
  o.castShadow = !['glow', 'emissive'].includes(kind) && !o.name.startsWith('GroundSnow');
  o.receiveShadow = true;
  if (o.name.startsWith('door_')) doorParts.push(o); else staticMeshes.push(o);
});
scene.add(root);
const door = new THREE.Object3D(); door.position.fromArray(meta.door_hinge); scene.add(door);
scene.updateMatrixWorld(true);
for (const m of doorParts) {
  if (meta.door_space === 'world') { door.attach(m); continue; }
  const M = m.matrixWorld.clone(); door.add(m); M.decompose(m.position, m.quaternion, m.scale);
}
// acceleration structure: camera clearance + explore-mode spring arm
for (const m of staticMeshes.concat(doorParts)) m.geometry.computeBoundsTree();

// ------------------------------------------------------------------ lights
const W2I = 1 / (4 * Math.PI);
scene.add(new THREE.HemisphereLight(0x8a90c8, 0x5a4038, 0.4));
const shopLights = [];
let keyLight;
for (const L of meta.lights) {
  const col = new THREE.Color().fromArray(L.color), P = V(...L.pos);
  if (L.name === 'Key') {
    keyLight = new THREE.DirectionalLight(col, 2.6);
    keyLight.position.copy(P); keyLight.target.position.set(1.5, 1.5, 0);
    keyLight.castShadow = true; keyLight.shadow.mapSize.set(2048, 2048);
    Object.assign(keyLight.shadow.camera, { left: -18, right: 18, top: 14, bottom: -10, near: 1, far: 70 });
    keyLight.shadow.radius = 6; keyLight.shadow.bias = -0.0005; keyLight.shadow.normalBias = 0.03;
    scene.add(keyLight, keyLight.target);
  } else if (L.name === 'Rim') { const d = new THREE.DirectionalLight(col, 1.4); d.position.copy(P); scene.add(d); }
  else if (L.name === 'Fill') { const d = new THREE.DirectionalLight(col, 0.35); d.position.copy(P); scene.add(d); }
  else if (L.type === 'POINT' || (L.type === 'AREA' && L.energy < 1000)) {
    const p = new THREE.PointLight(col, L.energy * W2I * (L.type === 'AREA' ? 0.22 : 0.45), L.type === 'AREA' ? 5 : 8, 2);
    p.position.copy(P);
    if (L.type === 'AREA') p.position.add(V(...L.dir).multiplyScalar(0.4));
    if (L.name.startsWith('Lamp')) { p.castShadow = true; p.shadow.mapSize.set(512, 512); p.shadow.bias = -0.002; }
    scene.add(p);
    if (/^(Interior|Inside|Spill\.|Spill$|awnLight)/.test(L.name)) shopLights.push(p);
  }
}
// the interior needs a little more of its own warm light to read as a lit room
const lampGlow = new THREE.PointLight(0xffa860, 2.2, 4.5, 2); lampGlow.position.copy(B(0, 1.5, 2.15)); scene.add(lampGlow);
const shelfGlow = new THREE.PointLight(0xffb070, 1.2, 3.0, 2); shelfGlow.position.copy(B(0.0, 2.6, 1.0)); scene.add(shelfGlow);
shopGlow.forEach((m) => { m.emissiveIntensity *= 0.55; });
const baseEmissive = shopGlow.map((m) => m.emissiveIntensity), baseShop = shopLights.map((l) => l.intensity);

// ------------------------------------------------------------------ characters
const STRIDE = 1.3;      // metres per walk cycle (two steps) — matched to the leg swing in the clip
function recolor(obj, map) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map((m) => { const c = m.clone(); const k = map[m.name]; if (k) c.color.set(k); c.userData = m.userData; return c; });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}
function makeMarine(colors) {
  const obj = skClone(mg.scene);
  if (colors) recolor(obj, colors);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const felt = /MarineCoat|MarineTrouser/.test(m.name);
      patch(m, felt ? 'felt' : 'clay', {}, true);
      if (felt) { m.roughness = 0.9; m.sheen = 0.25; m.sheenColor = new THREE.Color(0x7080b0); m.sheenRoughness = 0.6; }
    }
  });
  scene.add(obj);
  const mixer = new THREE.AnimationMixer(obj);
  const acts = {};
  for (const name of ['Walk', 'WalkCarry', 'Idle', 'IdleCarry']) {
    const a = mixer.clipAction(mg.animations.find((c) => c.name === name));
    a.play(); a.setEffectiveWeight(0); acts[name] = a;
  }
  const bones = {};
  obj.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  return { obj, mixer, acts, bones };
}
const A = makeMarine(null);
const Bm = makeMarine({ rt_MarineSkin: 0x8a5a3c, rt_MarineCheek: 0x9a5848, rt_MarineHair: 0x1a120e });
const gift = gg.scene;
gift.traverse((o) => { if (o.isMesh) { o.castShadow = true; patch(o.material, 'clay', {}, true); } });
scene.add(gift);

// ------------------------------------------------------------------ motion helpers (pure functions of t)
function makePath(pts) { return new THREE.CatmullRomCurve3(pts.map(([x, y]) => B(x, y, 0)), false, 'centripetal'); }
// trapezoid speed profile: ease in/out over `e` seconds, constant speed between
function travel(t, t0, L, v, e = 0.7) {
  const T = L / v + e;                   // total time with accel + decel
  const a = v / e;
  if (t <= t0) return { s: 0, v: 0, done: false };
  const u = t - t0;
  if (u >= T) return { s: L, v: 0, done: true };
  if (u < e) return { s: 0.5 * a * u * u, v: a * u, done: false };
  if (u > T - e) { const r = T - u; return { s: L - 0.5 * a * r * r, v: a * r, done: false }; }
  return { s: 0.5 * a * e * e + v * (u - e), v, done: false };
}
const yawOf = (dir) => Math.atan2(dir.x, dir.z);
function angLerp(a, b, k) { let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * k; }
// ground: cobbles, the shop step, then the shop floor (three.js y)
function groundY(p) {
  const by = -p.z;                       // Blender y
  if (Math.abs(p.x) > 0.75 || by < -0.62) return 0.06;
  if (by < 0.06) return lerp(0.06, 0.275, smooth((by + 0.62) / 0.05));
  return lerp(0.275, 0.47, smooth((by - 0.06) / 0.05));
}

// ---- the script --------------------------------------------------------------------
// Marine A: arrives from the west carrying the present, past the lamppost and the tree.
const PA = makePath([[-9.2, -3.3], [-6.2, -3.35], [-3.4, -3.55], [-1.0, -3.15], [1.75, -2.8]]);
const LA = PA.getLength(), A_T0 = 4.2, A_V = 1.0;
// Marine B: comes from the east, round the wagon, to meet A.
const PB1 = makePath([[10.6, -4.5], [6.6, -4.05], [4.1, -3.05], [2.55, -2.8]]);
const LB1 = PB1.getLength(), B_T0 = 10.4, B_V = 0.85;
// After the exchange B goes round A to the shop door, then inside.
const PB2 = makePath([[2.55, -2.8], [2.8, -2.1], [1.3, -1.95], [0.35, -1.45], [0.15, -0.42]]);
const LB2 = PB2.getLength(), B2_V = 0.8;
const PB3 = makePath([[0.15, -0.42], [0.12, 0.7], [0.32, 2.25]]);
const LB3 = PB3.getLength(), B3_V = 0.72;
const tA1 = A_T0 + LA / A_V + 0.7, tB1 = B_T0 + LB1 / B_V + 0.7;
const E0 = Math.max(tA1, tB1) + 0.4;                 // exchange begins
const SAL0 = E0 + 3.4;                               // A salutes, B nods and waves
const B2_T0 = SAL0 + 2.6;                            // B heads for the shop
const KNOB0 = B2_T0 + LB2 / B2_V + 0.8;              // B reaches the knob
const DOOR0 = KNOB0 + 0.45;                          // door starts to swing
const B3_T0 = DOOR0 + 0.85;                          // B steps inside
const B_TURN = B3_T0 + LB3 / B3_V + 0.9;             // B turns back to the camera
const END = B_TURN + 4.0;
const CHAPTERS = [['Arrival', 0], ['Following', 8], ['The meeting', tA1 + 0.5], ['Inside', KNOB0 - 1.5]];

// per-character state at time t (pose time tc may be stepped "on twos")
function charState(t) {
  const st = {};
  // ---- A
  {
    const m = travel(t, A_T0, LA, A_V);
    const u = clamp(m.s / LA);
    const p = PA.getPointAt(u), tan = PA.getTangentAt(Math.min(u, 0.999));
    let yaw = yawOf(tan);
    const faceB = yawOf(V(1, 0, 0));
    yaw = angLerp(yaw, faceB, ramp(t, tA1 - 0.6, tA1 + 0.6));
    // watch B walk off to the shop
    const look = ramp(t, B2_T0 + 0.5, B2_T0 + 2.0);
    st.A = { p, yaw, phase: m.s / STRIDE, speed: m.v, carry: 1 - ramp(t, E0 + 1.6, E0 + 2.3), lookAtB: look };
  }
  // ---- B
  {
    let p, yaw, phase, speed;
    const m1 = travel(t, B_T0, LB1, B_V);
    if (t < B2_T0) {
      const u = clamp(m1.s / LB1);
      p = PB1.getPointAt(u); yaw = yawOf(PB1.getTangentAt(Math.min(u, 0.999)));
      yaw = angLerp(yaw, yawOf(V(-1, 0, 0)), ramp(t, tB1 - 0.6, tB1 + 0.5));
      phase = m1.s / STRIDE; speed = m1.v;
    } else if (t < B3_T0) {
      const m2 = travel(t, B2_T0, LB2, B2_V, 0.8);
      const u = clamp(m2.s / LB2);
      p = PB2.getPointAt(u);
      const tanYaw = yawOf(PB2.getTangentAt(Math.min(Math.max(u, 0.02), 0.999)));
      yaw = angLerp(yawOf(V(-1, 0, 0)), tanYaw, ramp(t, B2_T0, B2_T0 + 0.9));
      yaw = angLerp(yaw, yawOf(V(0, 0, -1)), ramp(t, KNOB0 - 0.8, KNOB0));
      phase = (LB1 + m2.s) / STRIDE; speed = m2.v;
    } else {
      const m3 = travel(t, B3_T0, LB3, B3_V, 0.7);
      const u = clamp(m3.s / LB3);
      p = PB3.getPointAt(u);
      yaw = angLerp(yawOf(V(0, 0, -1)), yawOf(V(0, 0, 1)), ramp(t, B_TURN, B_TURN + 1.1));
      phase = (LB1 + LB2 + m3.s) / STRIDE; speed = m3.v;
      if (t > B_TURN) phase += Math.sin((t - B_TURN) / 1.1 * Math.PI) * 0.12 * (t < B_TURN + 1.1); // little turning steps
    }
    st.B = { p, yaw, phase, speed, carry: ramp(t, E0 + 2.0, E0 + 2.9) };
  }
  return st;
}

// ------------------------------------------------------------------ bones: FK blend, look, IK
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = V(), _v2 = V(), _v3 = V();
function setBoneWorldQuat(bone, qw) {
  bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(qw));
  bone.updateMatrixWorld(true);
}
function aimBone(bone, from, to) {
  const dq = new THREE.Quaternion().setFromUnitVectors(from, to);
  setBoneWorldQuat(bone, dq.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function rotateBoneWorld(bone, axis, ang) {
  const dq = new THREE.Quaternion().setFromAxisAngle(axis, ang);
  setBoneWorldQuat(bone, dq.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
// two-bone arm IK: wrist to target, elbow toward pole, blended with the animated pose by w
function ikArm(M, side, target, pole, w) {
  if (w <= 0.001) return;
  const u = M.bones['upper_arm' + side], f = M.bones['forearm' + side], h = M.bones['hand' + side];
  const S = u.getWorldPosition(V()), E = f.getWorldPosition(V()), W = h.getWorldPosition(V());
  const a = S.distanceTo(E), b = E.distanceTo(W);
  const dv = target.clone().sub(S);
  const d = clamp(dv.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = dv.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pl = pole.clone().sub(S); pl.sub(dir.clone().multiplyScalar(pl.dot(dir))).normalize();
  const En = S.clone().addScaledVector(dir, a * cosA).addScaledVector(pl, a * sinA);
  const Tg = S.clone().addScaledVector(dir, d);
  const q0 = u.quaternion.clone();
  aimBone(u, E.sub(S).normalize(), En.clone().sub(S).normalize());
  u.quaternion.slerpQuaternions(q0, u.quaternion.clone(), w); u.updateMatrixWorld(true);
  const E2 = f.getWorldPosition(V()), W2 = h.getWorldPosition(V());
  const q1 = f.quaternion.clone();
  aimBone(f, W2.sub(E2).normalize(), Tg.sub(E2).normalize());
  f.quaternion.slerpQuaternions(q1, f.quaternion.clone(), w); f.updateMatrixWorld(true);
}
function frame(M) {    // character's own axes in world space
  const q = M.obj.quaternion;
  return { fwd: V(0, 0, 1).applyQuaternion(q), left: V(1, 0, 0).applyQuaternion(q), up: V(0, 1, 0) };
}

function poseMarine(M, s, tc) {
  M.obj.position.set(s.p.x, groundY(s.p), s.p.z);
  M.obj.rotation.set(0, s.yaw, 0);
  M.obj.updateMatrixWorld(true);
  const walkW = smooth(s.speed / 0.45), c = clamp(s.carry);
  const W = { Walk: walkW * (1 - c), WalkCarry: walkW * c, Idle: (1 - walkW) * (1 - c), IdleCarry: (1 - walkW) * c };
  const wd = M.acts.Walk.getClip().duration, id = M.acts.Idle.getClip().duration;
  for (const [k, a] of Object.entries(M.acts)) {
    a.setEffectiveWeight(W[k]);
    a.time = k.startsWith('Walk') ? ((s.phase % 1) + 1) % 1 * wd : (tc % id);
  }
  M.mixer.update(0);
  M.obj.updateMatrixWorld(true);
}

// where the present sits when carried in the crook of the left arm (follows the animated hand)
const CARRY_OFS = V(-0.06, 0.115, -0.02), CARRY_YAW = 0.25;
function carryXform(M) {
  const hand = M.bones.handL.getWorldPosition(V());
  const local = M.obj.worldToLocal(hand).add(CARRY_OFS);
  const p = M.obj.localToWorld(local);
  const q = M.obj.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), CARRY_YAW));
  return { p, q };
}

// ------------------------------------------------------------------ evaluate the whole set at time t
function evaluate(T, steps) {
  const tc = steps ? Math.floor(T * 12) / 12 : T;       // puppets & props move on twos
  const st = charState(tc);
  poseMarine(A, st.A, tc);
  poseMarine(Bm, st.B, tc + 0.7);
  const fa = frame(A), fb = frame(Bm);
  // --- A watches B leave (head turn, body turns a little too)
  if (st.A.lookAtB > 0) {
    const hp = A.bones.head.getWorldPosition(V());
    const to = Bm.obj.position.clone().setY(hp.y).sub(hp).normalize();
    let ang = Math.atan2(to.x, to.z) - Math.atan2(fa.fwd.x, fa.fwd.z);
    ang = ((ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    rotateBoneWorld(A.bones.head, V(0, 1, 0), clamp(ang, -1.0, 1.0) * st.A.lookAtB * 0.8);
  }
  // --- the present
  const offerA = A.obj.position.clone().addScaledVector(fa.fwd, 0.3).setY(A.obj.position.y + 1.06);
  const offerB = Bm.obj.position.clone().addScaledVector(fb.fwd, 0.3).setY(Bm.obj.position.y + 1.06);
  const midG = offerA.clone().lerp(offerB, 0.5);
  const exQ = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), st.A.yaw);    // square to the pair
  const cA = carryXform(A), cB = carryXform(Bm);
  let gp, gq;
  const k1 = ramp(tc, E0 + 0.35, E0 + 1.2);           // A lifts it out of the crook of his arm
  const k2 = ramp(tc, E0 + 1.3, E0 + 1.8);            // ...and offers it forward
  const k2b = ramp(tc, E0 + 2.05, E0 + 2.65);         // B draws it to himself
  const k3 = ramp(tc, E0 + 2.75, E0 + 3.45);          // and tucks it into his own arm
  if (tc < E0 + 2.7) {
    gp = cA.p.clone().lerp(offerA, k1).lerp(midG, k2).lerp(offerB, k2b);
    gq = cA.q.clone().slerp(exQ, k1);
  } else {
    gp = offerB.clone().lerp(cB.p, k3);
    gq = exQ.clone().slerp(cB.q, k3);
  }
  gift.position.copy(gp); gift.quaternion.copy(gq); gift.updateMatrixWorld(true);
  // hands lock onto the sides of the present while it is being handed over
  const gl = V(1, 0, 0).applyQuaternion(gq);           // present's local x (its sides)
  const side = (M, f, sgn) => gp.clone().addScaledVector(gl, 0.135 * sgn).addScaledVector(f.fwd, -0.045).add(V(0, 0.035, 0));
  const polesDown = (M, f, s) => M.bones['upper_arm' + s].getWorldPosition(V()).add(V(0, -1, 0)).addScaledVector(f.left, s === 'L' ? 0.6 : -0.6).addScaledVector(f.fwd, -0.3);
  const sA = Math.sign(fa.left.dot(gl)) || 1, sB = Math.sign(fb.left.dot(gl)) || 1;
  const wA = ramp(tc, E0, E0 + 0.45) * (1 - ramp(tc, E0 + 2.1, E0 + 2.45));     // A lets go as B draws it in
  const wB = ramp(tc, E0 + 1.45, E0 + 1.95) * (1 - ramp(tc, E0 + 3.1, E0 + 3.45)); // B takes hold at the midpoint
  ikArm(A, 'L', side(A, fa, sA), polesDown(A, fa, 'L'), wA);
  ikArm(A, 'R', side(A, fa, -sA), polesDown(A, fa, 'R'), wA);
  ikArm(Bm, 'L', side(Bm, fb, sB), polesDown(Bm, fb, 'L'), wB);
  ikArm(Bm, 'R', side(Bm, fb, -sB), polesDown(Bm, fb, 'R'), wB * (1 - ramp(tc, E0 + 2.8, E0 + 3.2)));
  // --- A salutes: right hand to the cap brim, crisp up, held, crisp down
  const sal = ramp(tc, SAL0, SAL0 + 0.35) * (1 - ramp(tc, SAL0 + 1.7, SAL0 + 2.05));
  if (sal > 0) {
    const hd = A.bones.head.getWorldPosition(V());
    const tgt = hd.clone().addScaledVector(fa.up, 0.31).addScaledVector(fa.fwd, 0.17).addScaledVector(fa.left, -0.12);
    const pole = A.bones.upper_armR.getWorldPosition(V()).addScaledVector(fa.left, -1).addScaledVector(fa.fwd, 0.4);
    ikArm(A, 'R', tgt, pole, sal);
  }
  // --- B nods, then waves with his free hand
  const nod = Math.sin(clamp((tc - SAL0 - 0.3) / 0.8) * Math.PI);
  if (nod > 0) rotateBoneWorld(Bm.bones.head, fb.left, 0.22 * nod);
  const wave = ramp(tc, SAL0 + 0.7, SAL0 + 1.0) * (1 - ramp(tc, SAL0 + 2.0, SAL0 + 2.35));
  if (wave > 0) {
    const sh = Bm.bones.upper_armR.getWorldPosition(V());
    const tgt = sh.clone().addScaledVector(fb.up, 0.36).addScaledVector(fb.left, -0.2 - 0.07 * Math.sin((tc - SAL0) * 11)).addScaledVector(fb.fwd, 0.14);
    ikArm(Bm, 'R', tgt, sh.clone().addScaledVector(fb.left, -1).addScaledVector(fb.up, -0.6), wave);
  }
  // --- the door: B takes the knob, pushes, the door swings in on its own weight
  const swing = smooth(clamp((tc - DOOR0) / 1.9));
  door.rotation.y = THREE.MathUtils.degToRad(100) * (swing * 0.85 + 0.15 * Math.sin(swing * Math.PI / 2));
  door.updateMatrixWorld(true);
  const knob = door.localToWorld(V(0.905, 1.45, 0.07));
  const kw = ramp(tc, KNOB0, KNOB0 + 0.4) * (1 - ramp(tc, DOOR0 + 0.6, DOOR0 + 1.0));
  if (kw > 0) ikArm(Bm, 'R', knob, Bm.bones.upper_armR.getWorldPosition(V()).addScaledVector(fb.left, -1).add(V(0, -0.8, 0)), kw);
  // --- B waves goodbye from inside the shop
  const bye = ramp(tc, B_TURN + 1.3, B_TURN + 1.6) * (1 - ramp(tc, B_TURN + 3.0, B_TURN + 3.4));
  if (bye > 0) {
    const sh = Bm.bones.upper_armR.getWorldPosition(V());
    const tgt = sh.clone().addScaledVector(fb.up, 0.36).addScaledVector(fb.left, -0.2 - 0.07 * Math.sin((tc - B_TURN) * 11)).addScaledVector(fb.fwd, 0.14);
    ikArm(Bm, 'R', tgt, sh.clone().addScaledVector(fb.left, -1).addScaledVector(fb.up, -0.6), bye);
  }
  // --- light: windows breathe; the shop brightens as the door opens
  const fl = 1 + 0.02 * Math.sin(T * 7.3) + 0.012 * Math.sin(T * 13.1);
  shopGlow.forEach((m, i) => { m.emissiveIntensity = baseEmissive[i] * fl * (1 + 0.35 * swing); });
  shopLights.forEach((l, i) => { l.intensity = baseShop[i] * fl * (1 + 0.5 * swing); });
  return { st, swing };
}

// ------------------------------------------------------------------ the virtual cinematographer
// Each shot returns camera position, look target, horizontal FOV and focus distance at time t.
// Shots overlap and cross-blend, so the camera never cuts — one continuous move, like a moco rig.
function smoothState(t) {
  const st = charState(t);
  const mk = (c) => {
    const p = V(c.p.x, groundY(c.p), c.p.z);
    return { p, fwd: V(Math.sin(c.yaw), 0, Math.cos(c.yaw)), left: V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)) };
  };
  return { A: mk(st.A), B: mk(st.B) };
}
function keyed(keys, t) {   // Catmull-Rom through timed keys [[t, pos, look, fov], ...]
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = clamp((t - k1[0]) / (k2[0] - k1[0]));
  const cr = (a, b, c, d) => {
    const u2 = u * u, u3 = u2 * u;
    return b.clone().multiplyScalar(2).add(c.clone().sub(a).multiplyScalar(u))
      .add(a.clone().multiplyScalar(2).sub(b.clone().multiplyScalar(5)).add(c.clone().multiplyScalar(4)).sub(d).multiplyScalar(u2))
      .add(b.clone().multiplyScalar(3).sub(a).sub(c.clone().multiplyScalar(3)).add(d).multiplyScalar(u3)).multiplyScalar(0.5);
  };
  return { pos: cr(k0[1], k1[1], k2[1], k3[1]), look: cr(k0[2], k1[2], k2[2], k3[2]), fov: lerp(k1[3], k2[3], smooth(u)) };
}
const ARRIVE = [
  [0.0, B(-13.5, -27.5, 11.5), B(2.0, 4.0, 3.0), 34],
  [3.2, B(-11.8, -19.5, 7.6), B(0.0, 0.0, 2.4), 36],
  [6.4, B(-5.6, -12.2, 3.6), B(-5.4, -3.0, 1.3), 40],   // east of the big foreground fir
  [9.0, B(-3.7, -7.9, 1.45), B(-4.5, -3.3, 1.0), 48],
];
const ENTER = [   // hang back while he opens the door, then drift over the threshold behind him
  [KNOB0 - 1.2, B(0.95, -3.7, 1.62), B(0.1, -0.2, 1.42), 44],
  [DOOR0 + 1.0, B(0.45, -2.7, 1.62), B(0.05, 0.8, 1.42), 46],
  [B3_T0 + 1.6, B(0.18, -1.35, 1.6), B(0.05, 2.0, 1.38), 52],
  [B3_T0 + 3.8, B(0.06, -0.2, 1.6), B(0.0, 2.6, 1.42), 64],
  [END, B(0.03, 0.22, 1.58), B(-0.1, 2.6, 1.45), 70],
];
function shots(t) {
  const sm = smoothState(t), pa = sm.A.p, pb = sm.B.p;
  return [
    { t0: -1, t1: 9.0, f: () => { const k = keyed(ARRIVE, t); return { ...k, focus: k.pos.distanceTo(k.look) }; } },
    { t0: 7.6, t1: tA1 - 0.3, f: () => {   // tracking alongside A, street side, a little ahead
      const pos = pa.clone().add(B(1.15, -4.0, 1.3));
      const look = pa.clone().add(B(0.45, 0.1, 0.98));
      return { pos, look, fov: 52, focus: pos.distanceTo(pa) };
    } },
    { t0: tA1 - 1.6, t1: KNOB0 - 2.2, f: () => {   // the meeting: A waits, B walks in, the exchange
      const mid = pa.clone().lerp(pb, 0.5);
      const k = ramp(t, tA1 - 1.6, E0);
      const look = B(3.6, -3.4, 1.0).lerp(mid.clone().add(V(0, 1.08, 0)), k);
      const push = ramp(t, E0 - 1, E0 + 5);
      const pos = B(3.3, -7.8, 1.55).lerp(B(2.25, -6.9, 1.42), smooth(k)).lerp(B(2.2, -6.35, 1.36), push);
      // follow B a little as he heads for the door
      const out = ramp(t, B2_T0, B2_T0 + 2.5);
      return { pos: pos.lerp(B(1.2, -5.6, 1.35), out), look: look.lerp(pb.clone().add(V(0, 1.0, 0)), out), fov: lerp(52, 46, k), focus: pos.distanceTo(mid) };
    } },
    { t0: B2_T0 + 1.5, t1: KNOB0 + 0.2, f: () => {   // over B's shoulder toward the door
      const fb = sm.B;
      // on B's left: the side away from A, so the camera never brushes past him
      const pos = pb.clone().addScaledVector(fb.fwd, -2.3).addScaledVector(fb.left, 0.65).add(V(0, 1.25, 0));
      const look = pb.clone().add(V(0, 1.1, 0)).lerp(B(0.1, -0.1, 1.45), 0.55);
      return { pos, look, fov: 42, focus: pos.distanceTo(pb) };
    } },
    { t0: KNOB0 - 1.2, t1: END + 5, f: () => { const k = keyed(ENTER, t); return { ...k, focus: k.pos.distanceTo(pb) }; } },
  ];
}
const FADE = 1.4;
function direct(t) {
  const list = shots(t);
  let acc = null, wsum = 0;
  for (const s of list) {
    const w = ramp(t, s.t0, s.t0 + FADE) * (1 - ramp(t, s.t1 - FADE, s.t1));
    const w2 = s.t0 <= 0 ? (1 - ramp(t, s.t1 - FADE, s.t1)) : (s.t1 >= END ? ramp(t, s.t0, s.t0 + FADE) : w);
    if (w2 <= 1e-4) continue;
    const r = s.f();
    if (!acc) acc = { pos: V(), look: V(), fov: 0, focus: 0 };
    acc.pos.addScaledVector(r.pos, w2); acc.look.addScaledVector(r.look, w2); acc.fov += r.fov * w2; acc.focus += r.focus * w2;
    wsum += w2;
  }
  acc.pos.multiplyScalar(1 / wsum); acc.look.multiplyScalar(1 / wsum); acc.fov /= wsum; acc.focus /= wsum;
  return acc;
}

// ------------------------------------------------------------------ snow (culled inside the shop) + smoke
const NF = 6000, snowGeo = new THREE.BufferGeometry(), seed = new Float32Array(NF * 4);
for (let i = 0; i < NF; i++) seed.set([Math.random() * 40 - 18, Math.random() * 12.3 - 0.3, -(Math.random() * 44 - 30), Math.random()], i * 4);
snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
snowGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
const snowMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uT: { value: 0 }, uPx: { value: 800 }, uFocus: { value: 17 }, uAp: { value: 0.27 } },
  vertexShader: `attribute vec4 seed; uniform float uT, uPx, uFocus, uAp; varying float vA;
    void main(){ vec3 p = seed.xyz; float H = 12.3; p.y = -0.3 + mod(p.y + 0.3 - (1.0 + seed.w) * 1.2 * uT, H);
      p.x += 0.2 * sin(uT * (0.6 + seed.w) + seed.w * 40.0); p.z += 0.1 * cos(uT * 0.5 + seed.w * 17.0);
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
let composer, bokeh, gtao;
function buildPost() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.blendIntensity = 0.8; composer.addPass(gtao);
  bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0006, maxblur: 0.006 }); composer.addPass(bokeh);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.9));
  composer.addPass(new OutputPass());
}
buildPost();

// ------------------------------------------------------------------ camera clearance (spring arm in explore mode)
const ray = new THREE.Raycaster(); ray.firstHitOnly = true;
const collidables = staticMeshes.concat(doorParts);
function clearance(p, dirs = 14) {   // nearest surface distance (approx, by rays)
  let best = Infinity;
  for (let i = 0; i < dirs; i++) {
    const y = 1 - (i + 0.5) / dirs * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    ray.set(p, V(Math.cos(th) * r, y, Math.sin(th) * r)); ray.far = 2.0;
    const h = ray.intersectObjects(collidables, false)[0];
    if (h) best = Math.min(best, h.distance);
  }
  return best;
}

// ------------------------------------------------------------------ explore mode
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.8; controls.maxDistance = 30; controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
let exploring = false;
function springArm() {   // keep the free camera out of walls, roofs and trees
  const dir = camera.position.clone().sub(controls.target); const L = dir.length(); dir.normalize();
  ray.set(controls.target, dir); ray.far = L;
  const h = ray.intersectObjects(collidables, false)[0];
  if (h && h.distance < L) camera.position.copy(controls.target).addScaledVector(dir, Math.max(0.3, h.distance - 0.2));
}

// ------------------------------------------------------------------ playback, measurement
let T = +(Q.get('t') || 0), playing = !STILL && !AUDIT, steps = Q.get('twos') !== '0', last = performance.now();
const perf = { frames: [], start: 0 };
function render(dt) {
  const ev = evaluate(T, steps);
  if (!exploring) {
    const c = direct(T);
    camera.position.copy(c.pos); camera.lookAt(c.look); setFovH(c.fov);
    controls.target.copy(c.look);
    const inside = -camera.position.z > -0.6 && Math.abs(camera.position.x) < 1.2;
    camera.near = inside ? 0.05 : 0.2; camera.updateProjectionMatrix();
    if (bokeh) bokeh.uniforms.focus.value = c.focus;
    snowMat.uniforms.uFocus.value = c.focus;
  } else {
    controls.update(); springArm();
    const f = camera.position.distanceTo(controls.target);
    if (bokeh) bokeh.uniforms.focus.value = f; snowMat.uniforms.uFocus.value = f;
  }
  const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  snowMat.uniforms.uT.value = T + 3; snowMat.uniforms.uPx.value = px; smokeMat.uniforms.uT.value = T + 3; smokeMat.uniforms.uPx.value = px;
  if (postOn) composer.render(dt); else renderer.render(scene, camera);
  return ev;
}
const API = {
  duration: END, chapters: CHAPTERS, triangles: tris,
  get time() { return T; }, get playing() { return playing; }, get exploring() { return exploring; },
  play() { if (T >= END) T = 0; playing = true; exploring = false; controls.enabled = false; }, pause() { playing = false; },
  replay() { T = 0; playing = true; exploring = false; controls.enabled = false; perf.frames = []; },
  seek(t) { T = clamp(t, 0, END); },
  explore(on) { exploring = on; controls.enabled = on; if (on) { playing = false; } },
  stopMotion(on) { steps = on; }, effects(on) { postOn = on; },
  report() { return perfReport(); },
};
window.TT = API;

function perfReport() {
  const f = perf.frames.slice().sort((a, b) => a - b);
  if (f.length < 10) return null;
  const avg = f.reduce((s, x) => s + x, 0) / f.length;
  const pct = (p) => f[Math.min(f.length - 1, Math.floor(p * f.length))];
  let gpu = 'unknown';
  try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch (e) {}
  return { frames: f.length, avgFps: 1000 / avg, medianMs: pct(0.5), p95Ms: pct(0.95), p99Ms: pct(0.99), worstMs: f[f.length - 1],
           slowFrames: f.filter((x) => x > 33.4).length / f.length, gpu, pixels: renderer.domElement.width + 'x' + renderer.domElement.height,
           triangles: renderer.info.render.triangles, drawCalls: renderer.info.render.calls, effects: postOn };
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; setFovH(fovH);
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ---- headless modes -----------------------------------------------------------------
if (AUDIT) {      // camera clearance along the whole scripted move
  const out = []; let worst = { d: Infinity };
  for (let t = 0; t <= END; t += 0.1) {
    evaluate(t, false); const c = direct(t);
    const d = clearance(c.pos, 26);
    const dA = c.pos.distanceTo(A.obj.position.clone().add(V(0, 1, 0))), dB = c.pos.distanceTo(Bm.obj.position.clone().add(V(0, 1, 0)));
    out.push([+t.toFixed(1), +d.toFixed(3), +Math.min(dA, dB).toFixed(2)]);
    if (d < worst.d) worst = { d, t, pos: c.pos.toArray().map((v) => +v.toFixed(2)) };
  }
  window.__audit = { worst, samples: out, end: END };
  window.__ready = true;
} else if (Q.get('capture')) {   // review: render any moment on demand
  window.__shot = (t, w, h) => {
    if (w) { renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; }
    T = t; const t0 = performance.now(); render(1 / 24);
    const gl = renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { ms: performance.now() - t0, png: renderer.domElement.toDataURL('image/jpeg', 0.9) };
  };
  window.__ready = true;
} else if (STILL) {
  const gl = renderer.getContext(), px = new Uint8Array(4), times = [];
  for (let i = 0; i < +STILL; i++) {
    const t0 = performance.now(); render(1 / 24); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); times.push(performance.now() - t0);
  }
  window.__frameMs = times; window.__info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, end: END };
  window.__png = renderer.domElement.toDataURL('image/jpeg', 0.92); window.__ready = true;
} else {
  ui.ready && ui.ready(API);
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) {
      perf.frames.push(dt * 1000);
      T += dt;
      if (T >= END) { T = END; playing = false; ui.ended && ui.ended(perfReport()); }
    }
    render(dt);
    ui.tick && ui.tick(T, END, dt);
  });
}
