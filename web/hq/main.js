// Toy Town — visual-quality experiment: the blue shop, the pink house and their street,
// baked in Cycles, side by side (toggle) with the current real-time version.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const T_START = performance.now();
const Q = new URLSearchParams(location.search);
const A = window.TT_ASSETS || './assets/';
const ui = window.TT_UI || {};
const HEADLESS = Q.get('capture') || Q.get('measure');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!HEADLESS });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.get('dpr') ? +Q.get('dpr') : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const sky = (top, mid, low, bot) => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(0.8, low); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
const SKY_BEFORE = sky('#0e1022', '#2c2238', '#7a4a3c', '#3a2522');
const SKY_AFTER = sky('#101634', '#3a2c44', '#a5694a', '#4a2c22');      // a warmer dusk behind the set
scene.background = SKY_AFTER;
scene.fog = new THREE.FogExp2(0x2a2030, 0.018);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, +(Q.get('near') || 0.05), 400);
let fovH = 50;
function setFovH(h) { fovH = h; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect)); camera.updateProjectionMatrix(); }

// ------------------------------------------------------------------ the existing hand-made surface patch (live materials)
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
    const src = local ? 'vec4(position, 1.0)' : '(modelMatrix * vec4(transformed, 1.0))';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\nvWPos = ${src}.xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform int uKind; uniform vec3 uC2;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float drift = fbm(vWPos * 0.9);
        if (uKind == 2) { float st = step(0.5, fract((vWPos.x + 0.025*fbm(vWPos*4.0)) / 0.64)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, st); }
        diffuseColor.rgb *= uKind == 3 ? 0.92 + 0.16 * drift : 0.86 + 0.28 * drift;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float h, amp;
          if (uKind == 1) { h = -0.9*cells(vWPos*11.0) - 0.35*cells(vWPos*34.0) + 0.6*fbm(vWPos*6.0); amp = 0.035; }
          else if (uKind == 3) { h = 0.5*fbm(vWPos*60.0) + 0.5*fbm(vWPos*160.0) + 0.4*cells(vWPos*9.0); amp = 0.006; }
          else { h = 0.9*cells(vWPos*3.5 + fbm(vWPos*1.2)) + 0.6*fbm(vWPos*7.0) + 0.15*fbm(vWPos*90.0); amp = 0.025; }
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(h)*amp, dhy = dFdy(h)*amp;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2)); }`);
  };
  mat.customProgramCacheKey = () => 'tt-' + kind + (local ? '-l' : '');
}

// ------------------------------------------------------------------ baked material: Cycles light + texture, plus frost glitter
const glitterU = { uCam: { value: V() }, uKey: { value: V(-0.5, 0.6, 0.6).normalize() }, uGlit: { value: 1.0 } };
function bakedMaterial(tex, scale) {
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(scale, scale, scale) });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, glitterU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; uniform vec3 uCam, uKey; uniform float uGlit;
      float hh(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        // sugar-fine frost: tiny crystals that flash as the camera moves (bright, sky-facing surfaces only)
        vec3 N = normalize(cross(dFdx(vW), dFdy(vW)));
        vec3 cell = floor(vW * 260.0);
        float r = hh(cell);
        vec3 facet = normalize(vec3(hh(cell + 1.3) - 0.5, 1.2, hh(cell + 7.7) - 0.5) + N * 0.6);
        vec3 Vd = normalize(uCam - vW);
        float spec = pow(max(dot(reflect(-uKey, facet), Vd), 0.0), 90.0);
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
        float mask = smoothstep(0.42, 0.75, lum) * smoothstep(0.1, 0.6, N.y) * step(0.93, r);
        float fade = 1.0 - smoothstep(4.0, 16.0, length(uCam - vW));
        diffuseColor.rgb += vec3(1.0, 0.96, 0.88) * spec * mask * fade * 2.6 * uGlit;
      }`);
  };
  m.customProgramCacheKey = () => 'baked';
  return m;
}

// ------------------------------------------------------------------ load (timed)
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loadLog = [];
async function fetchBuf(name) {
  const t0 = performance.now();
  const b64 = window.TT_B64 && window.TT_B64[name];
  let buf;
  if (b64) { const txt = await (await fetch(b64)).text(); buf = Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0)).buffer; }
  else buf = await (await fetch(A + name)).arrayBuffer();
  loadLog.push({ name, kb: Math.round(buf.byteLength / 1024), ms: Math.round(performance.now() - t0) });
  return buf;
}
const glb = async (name) => loader.parseAsync(await fetchBuf(name), '');
async function texture(name) {
  const t0 = performance.now();
  const url = (window.TT_IMG && window.TT_IMG[name]) || A + name;
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  loadLog.push({ name, kb: null, ms: Math.round(performance.now() - t0), px: t.image.width });
  return t;
}
ui.status && ui.status('Setting up the miniature set…');
const meta = await (await fetch(A + 'hq.json')).json();
const KEYS = Object.keys(meta.bake);
const [before, rest, doorLive, marineG, ...bakedG] = await Promise.all([
  glb('before.glb'), glb('rest.glb'), glb('door_live.glb'), glb('marine.glb'), ...KEYS.map((k) => glb(`baked_${k}.glb`))]);
const bakedT = await Promise.all(KEYS.map((k) => texture(`bake_${k}.webp`)));
const T_LOADED = performance.now();

const groupBefore = new THREE.Group(), groupAfter = new THREE.Group();
scene.add(groupBefore, groupAfter);
const live = (root, into, collide) => {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeVertexNormals();
    const m = o.material, ex = m.userData || {}, kind = ex.kind || 'clay';
    if (kind === 'ice') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.1; }
    if (['clay', 'snow', 'wood', 'cobble', 'fabric'].includes(kind)) patch(m, kind, ex);
    if (kind === 'snow') { m.roughness = 0.75; m.color.multiplyScalar(1.05); }
    o.castShadow = !['glow', 'emissive'].includes(kind) && !o.name.startsWith('GroundSnow');
    o.receiveShadow = true;
    if (collide) collide.push(o);
  });
  into.add(root);
};
// BEFORE: the current real-time scene, untouched
const doorBefore = new THREE.Object3D(); doorBefore.position.fromArray(meta.door_hinge); groupBefore.add(doorBefore);
live(before.scene, groupBefore);
groupBefore.updateMatrixWorld(true);
const bParts = []; before.scene.traverse((o) => { if (o.isMesh && o.name.startsWith('door_')) bParts.push(o); });
for (const m of bParts) { const M = m.matrixWorld.clone(); doorBefore.add(m); M.decompose(m.position, m.quaternion, m.scale); }
// AFTER: baked area + the rest of the village + the door's live glass
live(rest.scene, groupAfter); if (Q.get('norest')) rest.scene.visible = false;
const doorAfter = new THREE.Object3D(); doorAfter.position.fromArray(meta.door_hinge); groupAfter.add(doorAfter);
let bakedTris = 0;
KEYS.forEach((k, i) => {
  const t = bakedT[i];
  bakedG[i].scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = bakedMaterial(t, meta.bake[k].scale);
    o.castShadow = true; o.receiveShadow = false;
    bakedTris += o.geometry.index ? o.geometry.index.count / 3 : 0;
  });
  if (k === 'door') { groupAfter.updateMatrixWorld(true); bakedG[i].scene.updateMatrixWorld(true); doorAfter.attach(bakedG[i].scene); }
  else groupAfter.add(bakedG[i].scene);
});
live(doorLive.scene, groupAfter); groupAfter.updateMatrixWorld(true); doorAfter.attach(doorLive.scene);
const shopGlowB = [], shopGlowA = [];
before.scene.traverse((o) => { if (o.isMesh && o.material.name.includes('ShopGlow')) shopGlowB.push(o.material); });
[rest.scene, doorLive.scene].forEach((r) => r.traverse((o) => { if (o.isMesh && /ShopGlow|PinkGlow|UpperGlow|FairyLight|LampGlass/.test(o.material.name)) shopGlowA.push({ m: o.material, base: o.material.emissiveIntensity }); }));

// ------------------------------------------------------------------ lights (real-time, for the live objects and the Marine)
const W2I = 1 / (4 * Math.PI);
const hemi = new THREE.HemisphereLight(0x8a90c8, 0x5a4038, 0.4); scene.add(hemi);
const lights = [];
for (const L of meta.lights) {
  const col = new THREE.Color().fromArray(L.color), P = V(...L.pos);
  let l = null;
  if (L.name === 'Key') {
    l = new THREE.DirectionalLight(col, 2.6); l.position.copy(P); l.target.position.set(1.5, 1.5, 0);
    l.castShadow = true; l.shadow.mapSize.set(2048, 2048);
    Object.assign(l.shadow.camera, { left: -18, right: 18, top: 14, bottom: -10, near: 1, far: 70 });
    l.shadow.radius = 6; l.shadow.bias = -0.0005; l.shadow.normalBias = 0.03; scene.add(l.target);
  } else if (L.name === 'Rim') l = new THREE.DirectionalLight(col, 1.4);
  else if (L.name === 'Fill') l = new THREE.DirectionalLight(col, 0.35);
  else if (L.type === 'POINT' || (L.type === 'AREA' && L.energy < 1000)) {
    l = new THREE.PointLight(col, L.energy * W2I * (L.type === 'AREA' ? 0.22 : 0.45), L.type === 'AREA' ? 5 : 8, 2);
    if (L.type === 'AREA') P.add(V(...L.dir).multiplyScalar(0.4));
  }
  if (l) { l.position.copy(P); scene.add(l); lights.push(l); }
}

// ------------------------------------------------------------------ Marine on his rounds
const marine = marineG.scene;
marine.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; patch(o.material, /Coat|Trouser/.test(o.material.name) ? 'felt' : 'clay', {}, true); } });
scene.add(marine);
const mixer = new THREE.AnimationMixer(marine);
const walk = mixer.clipAction(marineG.animations.find((a) => a.name === 'Walk') || marineG.animations[0]); walk.play();
const B2T = ([x, y]) => V(x, 0.06, -y);
const path = new THREE.CatmullRomCurve3([[-8.5, -3.4], [-5.6, -3.3], [-2.6, -2.0], [0.4, -1.75], [3.4, -1.9], [5.8, -2.1], [7.4, -3.7],
  [9.6, -3.4], [11.8, -3.6], [10.2, -5.2], [6.0, -5.3], [1.5, -5.1], [-3.0, -4.9], [-7.4, -4.6], [-9.6, -4.0]].map(B2T), true, 'centripetal');
const PATH_L = path.getLength();
let stopMotion = true, along = Q.get('along') ? +Q.get('along') : 0.32;
function updateMarine(dt, t) {
  along = (along + dt * 1.0 / PATH_L) % 1;
  const tc = stopMotion ? Math.floor(t * 12) / 12 : t;
  const u = stopMotion ? ((Math.floor(along * PATH_L * 12) / 12) / PATH_L) % 1 : along;
  const p = path.getPointAt(u), a = path.getPointAt((u + 0.004) % 1);
  marine.position.copy(p); marine.lookAt(a.x, p.y, a.z);
  walk.time = (tc / 1.3) % walk.getClip().duration; mixer.update(0);
}

// ------------------------------------------------------------------ snow + smoke
const NF = 6000, snowGeo = new THREE.BufferGeometry(), seed = new Float32Array(NF * 4);
for (let i = 0; i < NF; i++) seed.set([Math.random() * 40 - 18, Math.random() * 12.3 - 0.3, -(Math.random() * 44 - 30), Math.random()], i * 4);
snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
snowGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
const snowMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uT: { value: 0 }, uPx: { value: 800 }, uFocus: { value: 17 }, uAp: { value: 0.27 } },
  vertexShader: `attribute vec4 seed; uniform float uT, uPx, uFocus, uAp; varying float vA;
    void main(){ vec3 p = seed.xyz; p.y = -0.3 + mod(p.y + 0.3 - (1.0 + seed.w) * 1.2 * uT, 12.3);
      p.x += 0.2 * sin(uT * (0.6 + seed.w) + seed.w * 40.0); p.z += 0.1 * cos(uT * 0.5 + seed.w * 17.0);
      bool inShop = p.x > -2.8 && p.x < 2.8 && p.z < 0.05 && p.z > -5.2 && p.y < 9.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float z = -mv.z; gl_Position = projectionMatrix * mv;
      float r = (0.008 + 0.016 * seed.w) * uPx / z; float coc = uAp * 0.036 * abs(z - uFocus) / (z * uFocus) * uPx * 25.0;
      float R = max(max(r, coc * 0.5), 0.7); vA = clamp((max(r, 0.7) / R) * (max(r, 0.7) / R), 0.03, 1.0) * 0.9;
      gl_PointSize = inShop || z < 0.15 ? 0.0 : min(2.0 * R, 90.0); }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.75, d) * vA;
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * 0.95, a); }`,
});
const snowPts = new THREE.Points(snowGeo, snowMat); snowPts.frustumCulled = false; scene.add(snowPts);
const NS = 60, smokeGeo = new THREE.BufferGeometry(), sseed = new Float32Array(NS);
for (let i = 0; i < NS; i++) sseed[i] = i / NS;
smokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
smokeGeo.setAttribute('s', new THREE.BufferAttribute(sseed, 1));
const smokeMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uT: { value: 0 }, uO: { value: V(-1.15, 9.22, -2.2) }, uPx: { value: 800 } },
  vertexShader: `attribute float s; uniform float uT, uPx; uniform vec3 uO; varying float vA;
    void main(){ float a = fract(s + uT * 0.06); vec3 p = uO + vec3(0.6 * a + 0.15 * sin(a * 9.0 + s * 30.0), a * 3.2, -0.3 * a);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.25 + 1.3 * a) * uPx / -mv.z; vA = smoothstep(0.0, 0.12, a) * (1.0 - a) * 0.22; }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(0.62, 0.56, 0.58, smoothstep(1.0, 0.0, d) * vA); }`,
});
const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);

// ------------------------------------------------------------------ post: AO, DOF, selective bloom, warm/cool grade
let composer, bokeh, bloom, gtao, grade;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 1 }, uSat: { value: +(Q.get('sat') || 1.75) }, uCon: { value: +(Q.get('con') || 1.25) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt, uSat, uCon; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.86, 0.94, 1.12), lightTint = vec3(1.08, 1.0, 0.86);
      vec3 g = c.rgb * mix(shadowTint, lightTint, smoothstep(0.02, 0.5, l));
      g = mix(vec3(dot(g, vec3(0.2126, 0.7152, 0.0722))), max(g, 0.0), uSat);   // AgX desaturates: pre-saturate (Blender's 'Punchy' look)
      g = 0.18 * pow(max(g, 0.0) / 0.18, vec3(uCon));                       // and add contrast around mid-grey
      vec2 q = vUv - 0.5; float vig = 1.0 - 0.38 * smoothstep(0.25, 0.8, dot(q, q) * 2.2);
      gl_FragColor = vec4(mix(c.rgb, g * vig, uAmt), c.a); }`,
};
function buildPost() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight); gtao.blendIntensity = 0.8; composer.addPass(gtao);
  bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0006, maxblur: 0.006 }); composer.addPass(bokeh);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.9); composer.addPass(bloom);
  grade = new ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new OutputPass());
}
buildPost();

// ------------------------------------------------------------------ before / after
let mode = Q.get('before') ? 'before' : 'after';
function applyMode() {
  const a = mode === 'after';
  groupAfter.visible = a; groupBefore.visible = !a;
  scene.background = a ? SKY_AFTER : SKY_BEFORE;
  renderer.toneMappingExposure = a ? +(Q.get('exp') || 0.66) : 1.25;
  gtao.blendIntensity = a ? 0.45 : 0.8;             // baked surfaces already carry their contact shading
  bloom.threshold = a ? 0.95 : 0.9; bloom.strength = a ? +(Q.get('bloom') || 0.3) : 0.35; bloom.radius = a ? 0.55 : 0.5;
  grade.uniforms.uAmt.value = a ? 1 : 0;
  hemi.intensity = a ? 0.55 : 0.4;
  glitterU.uGlit.value = a ? 1 : 0;
}
applyMode();

// ------------------------------------------------------------------ cameras
const cams = meta.cameras;
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = 0.6; controls.maxDistance = 40;
controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
let tween = null;
function goCam(name, instant) {
  const c = cams[name]; if (!c) return;
  const to = { p: V(...c.pos), t: V(...c.target), f: c.fov_h };
  if (instant) { camera.position.copy(to.p); controls.target.copy(to.t); setFovH(to.f); tween = null; controls.update(); return; }
  tween = { k: 0, p0: camera.position.clone(), t0: controls.target.clone(), f0: fovH, to };
}
goCam(Q.get('cam') || 'Hero', true);
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let doorOpen = 0, doorTarget = 0;
renderer.domElement.addEventListener('click', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera);
  const tgt = []; (mode === 'after' ? doorAfter : doorBefore).traverse((o) => o.isMesh && tgt.push(o));
  if (ray.intersectObjects(tgt, false).length) doorTarget = doorTarget ? 0 : 1;
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; setFovH(fovH); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

// ------------------------------------------------------------------ frame
let T = 0, last = performance.now();
function frame(dt) {
  T += dt;
  if (tween) {
    tween.k = clamp(tween.k + dt / 2.4); const e = smooth(tween.k);
    camera.position.lerpVectors(tween.p0, tween.to.p, e); controls.target.lerpVectors(tween.t0, tween.to.t, e); setFovH(tween.f0 + (tween.to.f - tween.f0) * e);
    if (tween.k >= 1) tween = null;
  }
  controls.update();
  updateMarine(dt, T);
  doorOpen += (doorTarget - doorOpen) * Math.min(1, dt * 2.2);
  const ang = THREE.MathUtils.degToRad(104) * doorOpen * doorOpen * (3 - 2 * doorOpen);
  doorBefore.rotation.y = ang; doorAfter.rotation.y = ang;
  const fl = 1 + 0.02 * Math.sin(T * 7.3) + 0.012 * Math.sin(T * 13.1);
  shopGlowB.forEach((m) => { m.emissiveIntensity = 1.2 * fl; });
  shopGlowA.forEach((g) => { g.m.emissiveIntensity = g.base * fl; });
  const focus = camera.position.distanceTo(controls.target) * 0.95;
  bokeh.uniforms.focus.value = focus; snowMat.uniforms.uFocus.value = focus;
  bokeh.uniforms.aperture.value = window.__dof ?? (focus < 6 ? 0.0011 : 0.0006);
  const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  snowMat.uniforms.uT.value = T + 3; snowMat.uniforms.uPx.value = px; smokeMat.uniforms.uT.value = T + 3; smokeMat.uniforms.uPx.value = px;
  glitterU.uCam.value.copy(camera.position);
  renderer.info.reset();
  composer.render(dt);
}

function textureMB() {
  let b = 0; const seen = new Set();
  scene.traverse((o) => { const m = o.material; if (!m || !m.map || seen.has(m.map)) return; seen.add(m.map); const im = m.map.image; b += im.width * im.height * 4 * 1.333; });
  return b / 1048576;
}
function geometryMB(root) {
  let b = 0; const seen = new Set();
  root.traverse((o) => { if (!o.geometry || seen.has(o.geometry)) return; seen.add(o.geometry); for (const a of Object.values(o.geometry.attributes)) b += a.array.byteLength; if (o.geometry.index) b += o.geometry.index.array.byteLength; });
  return b / 1048576;
}
const API = {
  cams: Object.keys(cams), goCam, get mode() { return mode; },
  setMode(m) { mode = m; applyMode(); }, toggleDoor() { doorTarget = doorTarget ? 0 : 1; }, stopMotion(v) { stopMotion = v; },
  load: () => ({ totalMs: Math.round(T_LOADED - T_START), files: loadLog }),
  stats: () => ({ textureMB: +textureMB().toFixed(1), geometryAfterMB: +geometryMB(groupAfter).toFixed(1), geometryBeforeMB: +geometryMB(groupBefore).toFixed(1),
                  bakedTriangles: bakedTris, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  async measure(frames = 90, cb) {
    const rows = []; const gl = renderer.getContext(), px = new Uint8Array(4);
    for (const m of ['before', 'after']) for (const c of ['Hero', 'StreetLevel', 'Facade', 'DownTheStreet']) {
      mode = m; applyMode(); goCam(c, true);
      for (let i = 0; i < 3; i++) frame(1 / 60);
      const ms = [];
      for (let i = 0; i < frames; i++) { const t0 = performance.now(); frame(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ms.push(performance.now() - t0); if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0)); }
      ms.sort((a, b) => a - b); const avg = ms.reduce((s, x) => s + x, 0) / ms.length;
      const row = { version: m, camera: c, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(1), p95Ms: +ms[Math.floor(ms.length * 0.95)].toFixed(1), draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      rows.push(row); cb && cb(row);
    }
    mode = 'after'; applyMode();
    let gpu = 'unknown'; try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); } catch (e) {}
    return { rows, stats: API.stats(), load: API.load(), gpu, canvas: renderer.domElement.width + 'x' + renderer.domElement.height };
  },
};
window.TT = API;
if (Q.get('capture')) {
  window.__shot = (cam, m, w, h) => {
    if (w) { renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; }
    mode = m; applyMode(); goCam(cam, true);
    for (let i = 0; i < 2; i++) frame(1 / 24);
    return { png: renderer.domElement.toDataURL('image/jpeg', 0.93), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  };
  window.__ready = true;
} else if (Q.get('measure')) { window.__ready = true; }
else {
  ui.ready && ui.ready(API);
  renderer.setAnimationLoop((now) => { const dt = clamp((now - last) / 1000, 0, 0.1); last = now; frame(dt); ui.tick && ui.tick(dt, renderer.info.render); });
}
