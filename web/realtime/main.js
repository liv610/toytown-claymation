// Real-time test: the actual 3D scene in Three.js, with a best-effort attempt
// at the handcrafted look (world-space clay bump + colour drift, stripes,
// soft shadows, AO, depth of field, bloom, AgX).  Compare against the Cycles frame.
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

const Q = new URLSearchParams(location.search);
const ASSETS = window.TT_ASSETS || './assets/';
const POST = Q.get('post') !== '0';
const SHADOWS = Q.get('shadows') !== '0';
const hud = document.getElementById('stats') || document.getElementById('hud');

const STILL = Q.get('still');
const renderer = new THREE.WebGLRenderer({ antialias: !POST, powerPreference: 'high-performance', preserveDrawingBuffer: !!STILL });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.get('dpr') ? +Q.get('dpr') : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = +(Q.get('exposure') || 1.25);
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
{ // dusk gradient sky as a screen-space background
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#0e1022'); gr.addColorStop(0.55, '#2c2238'); gr.addColorStop(0.8, '#7a4a3c'); gr.addColorStop(1, '#3a2522');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
scene.fog = new THREE.FogExp2(0x2a2030, 0.018);

const meta = await (await fetch(ASSETS + 'scene.json')).json();
const cams = meta.cameras;
const startCam = cams[Q.get('cam') || 'Hero'];
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 300);
function setFovFromHorizontal(h) {
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect));
  camera.updateProjectionMatrix();
}
camera.position.fromArray(startCam.pos);
setFovFromHorizontal(startCam.fov_h);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(startCam.target);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.minDistance = 4; controls.maxDistance = 32;
controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
controls.update();
let tween = null, fovH = startCam.fov_h;
window.__goCam = (name) => {
  const c = cams[name]; if (!c) return;
  tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), f0: fovH,
            p1: new THREE.Vector3().fromArray(c.pos), t1: new THREE.Vector3().fromArray(c.target), f1: c.fov_h };
};
window.__cams = Object.keys(cams);

// ---------- handcrafted-look shader patch (world-space, no UVs needed) ----------
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
function patch(mat, kind, extras) {
  const c2 = extras.color2 ? new THREE.Color().fromArray(extras.color2) : null;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uKind = { value: { clay: 0, wood: 0, cobble: 0, snow: 1, fabric: 2 }[kind] ?? 0 };
    sh.uniforms.uC2 = { value: c2 || new THREE.Color(1, 1, 1) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform int uKind; uniform vec3 uC2;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float drift = fbm(vWPos * 0.9);
        if (uKind == 2) { float st = step(0.5, fract((vWPos.x + 0.025*fbm(vWPos*4.0)) / 0.64)); diffuseColor.rgb = mix(diffuseColor.rgb, uC2, st); }
        diffuseColor.rgb *= 0.86 + 0.28 * drift;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float h;
          if (uKind == 1) h = -0.9*cells(vWPos*11.0) - 0.35*cells(vWPos*34.0) + 0.6*fbm(vWPos*6.0);
          else h = 0.9*cells(vWPos*3.5 + fbm(vWPos*1.2)) + 0.6*fbm(vWPos*7.0) + 0.15*fbm(vWPos*90.0);
          float amp = uKind == 1 ? 0.035 : 0.025;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(h)*amp, dhy = dFdy(h)*amp;
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  mat.customProgramCacheKey = () => 'tt-' + kind;
}

// ---------- scene ----------
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let gltf;
if (window.TT_GLB_B64) {   // hosts that cannot serve .glb: the model ships as base64 text
  const b64 = await (await fetch(window.TT_GLB_B64)).text();
  const bin = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
  gltf = await loader.parseAsync(bin.buffer, '');
} else gltf = await loader.loadAsync(ASSETS + 'toytown_web.glb');
const root = gltf.scene;
const shopGlow = []; let tris = 0;
const doorParts = [];
root.traverse((o) => {
  if (!o.isMesh) return;
  if (o.name.startsWith('door_')) doorParts.push(o);
  o.geometry.computeVertexNormals();
  tris += o.geometry.index ? o.geometry.index.count / 3 : 0;
  const m = o.material, ex = m.userData || {};
  const kind = ex.kind || 'clay';
  if (kind === 'ice') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.1; }
  if (['clay', 'snow', 'wood', 'cobble', 'fabric'].includes(kind)) patch(m, kind, ex);
  if (kind === 'snow') { m.roughness = 0.75; m.color.multiplyScalar(1.05); }
  if (m.emissiveIntensity > 0 && m.name.includes('ShopGlow')) shopGlow.push(m);
  o.castShadow = !['glow', 'emissive'].includes(kind) && !o.name.startsWith('GroundSnow');
  o.receiveShadow = true;
});
scene.add(root);
// the door swings on a pivot at its hinge (world-space parts re-parented, transforms preserved)
const door = new THREE.Object3D(); door.position.fromArray(meta.door_hinge); scene.add(door);
scene.updateMatrixWorld(true);
for (const m of doorParts) {
  if (meta.door_space === 'world') { door.attach(m); continue; }
  // older export: vertices are already hinge-relative, so the mesh's current world
  // transform is really its transform relative to the hinge
  const M = m.matrixWorld.clone(); door.add(m); M.decompose(m.position, m.quaternion, m.scale);
}

// ---------- lights (from the Blender scene) ----------
const Y = (a) => new THREE.Vector3().fromArray(a);
const W2I = 1 / (4 * Math.PI);                  // Blender point watts -> radiant intensity, then tuned
scene.add(new THREE.HemisphereLight(0x8a90c8, 0x5a4038, 0.4));
const interiorLights = [];
for (const L of meta.lights) {
  const col = new THREE.Color().fromArray(L.color);
  if (L.name === 'Key') {
    const d = new THREE.DirectionalLight(col, 2.6);
    d.position.copy(Y(L.pos)); d.target.position.set(1.5, 1.5, 0);
    d.castShadow = SHADOWS; d.shadow.mapSize.set(2048, 2048);
    Object.assign(d.shadow.camera, { left: -18, right: 18, top: 14, bottom: -10, near: 1, far: 70 });
    d.shadow.radius = 6; d.shadow.bias = -0.0005; d.shadow.normalBias = 0.03;
    scene.add(d, d.target);
  } else if (L.name === 'Rim') {
    const d = new THREE.DirectionalLight(col, 1.4); d.position.copy(Y(L.pos)); scene.add(d);
  } else if (L.name === 'Fill') {
    const d = new THREE.DirectionalLight(col, 0.35); d.position.copy(Y(L.pos)); scene.add(d);
  } else if (L.type === 'POINT' || (L.type === 'AREA' && L.energy < 1000)) {
    const p = new THREE.PointLight(col, L.energy * W2I * (L.type === 'AREA' ? 0.22 : 0.45), L.type === 'AREA' ? 5 : 8, 2);
    p.position.copy(Y(L.pos));
    if (L.type === 'AREA') p.position.add(Y(L.dir).multiplyScalar(0.4));
    if (L.name.startsWith('Lamp') && SHADOWS) { p.castShadow = true; p.shadow.mapSize.set(512, 512); p.shadow.bias = -0.002; }
    p.userData = L; scene.add(p);
    if (L.lightgroup === 'shop') interiorLights.push(p);
  }
}

// ---------- the Marine: skinned clay puppet + walk clip, steered along a path (game-style) ----------
async function loadGLB(b64url, url) {
  if (b64url) {
    const b64 = await (await fetch(b64url)).text();
    return loader.parseAsync(Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0)).buffer, '');
  }
  return loader.loadAsync(url);
}
const mg = await loadGLB(window.TT_MARINE_B64, ASSETS + 'marine.glb');
const marine = mg.scene;
marine.traverse((o) => {
  if (!o.isMesh) return;
  o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
  const k = o.material.userData.kind || 'clay';
  if (k === 'felt' || k === 'clay') patch(o.material, 'clay', {});
});
scene.add(marine);
const mixer = new THREE.AnimationMixer(marine);
const walk = mixer.clipAction(mg.animations.find((a) => a.name === 'Walk') || mg.animations[0]);
walk.play();
// a loop along the cobbles: past the lamppost, in front of the shop, round the wagon, back on the far side
const B2T = ([x, y]) => new THREE.Vector3(x, 0.06, -y);      // Blender (x, y) ground -> three.js
const path = new THREE.CatmullRomCurve3([
  [-8.5, -3.4], [-5.6, -3.3], [-2.6, -2.0], [0.4, -1.75], [3.4, -1.9], [5.8, -2.1], [7.4, -3.7], [9.6, -3.4],
  [11.8, -3.6], [10.2, -5.2], [6.0, -5.3], [1.5, -5.1], [-3.0, -4.9], [-7.4, -4.6], [-9.6, -4.0],
].map(B2T), true, 'centripetal');
const PATH_LEN = path.getLength();
const STRIDE = 1.3;                         // metres travelled per walk cycle (two steps), matched to the leg swing
const SPEED = 1.0;                          // m/s
walk.timeScale = SPEED / STRIDE;
let along = 0.12, stopMotion = Q.get('twos') === '1', animClock = 0;
window.__setStopMotion = (v) => { stopMotion = v; };
function updateMarine(dt) {
  along = (along + dt * SPEED / PATH_LEN) % 1;
  const p = path.getPointAt(along), ahead = path.getPointAt((along + 0.004) % 1);
  animClock += dt;
  // stop-motion: the puppet is re-posed and moved only 12 times a second ("on twos")
  const tPose = stopMotion ? Math.floor(animClock * 12) / 12 : animClock;
  const pPose = stopMotion ? path.getPointAt(((Math.floor(along * PATH_LEN / SPEED * 12) / 12) * SPEED / PATH_LEN) % 1) : p;
  walk.time = (tPose * walk.timeScale) % walk.getClip().duration; mixer.update(0);
  marine.position.copy(pPose);
  marine.lookAt(ahead.x, pPose.y, ahead.z);
}
// third-person follow camera, low and to the side like the reference shot
let follow = false;
const followPos = new THREE.Vector3(), followLook = new THREE.Vector3();
window.__follow = () => { follow = true; tween = null; };
const _goCam = window.__goCam;
window.__goCam = (n) => { follow = false; _goCam(n); };
function updateFollow(dt) {
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(marine.quaternion);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(marine.quaternion);
  const want = marine.position.clone().addScaledVector(fwd, 3.1).addScaledVector(side, -1.8).add(new THREE.Vector3(0, 0.8, 0));
  const look = marine.position.clone().add(new THREE.Vector3(0, 0.95, 0)).addScaledVector(fwd, 0.4);
  const k = 1 - Math.exp(-dt * 2.5);
  if (followPos.lengthSq() === 0) { followPos.copy(camera.position); followLook.copy(controls.target); }
  followPos.lerp(want, k); followLook.lerp(look, k);
  camera.position.copy(followPos); controls.target.copy(followLook);
  fovH += (40 - fovH) * k; setFovFromHorizontal(fovH);
}

// ---------- falling snow: real 3D points, depth-tested against the scene ----------
const NF = 6000, snowGeo = new THREE.BufferGeometry();
const seed = new Float32Array(NF * 4);
for (let i = 0; i < NF; i++) seed.set([Math.random() * 40 - 18, Math.random() * 12.3 - 0.3, -(Math.random() * 44 - 30), Math.random()], i * 4);
snowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
snowGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
const snowMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uT: { value: 0 }, uPx: { value: 800 }, uFocus: { value: 17 }, uAp: { value: 0.27 } },
  vertexShader: `attribute vec4 seed; uniform float uT, uPx, uFocus, uAp; varying float vA;
    void main(){ vec3 p = seed.xyz; float H = 12.3; p.y = -0.3 + mod(p.y + 0.3 - (1.0 + seed.w) * 1.2 * uT, H);
      p.x += 0.2 * sin(uT * (0.6 + seed.w) + seed.w * 40.0); p.z += 0.1 * cos(uT * 0.5 + seed.w * 17.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float z = -mv.z; gl_Position = projectionMatrix * mv;
      float r = (0.008 + 0.016 * seed.w) * uPx / z; float coc = uAp * 0.036 * abs(z - uFocus) / (z * uFocus) * uPx * 25.0;
      float R = max(max(r, coc * 0.5), 0.7); vA = clamp((max(r, 0.7) / R) * (max(r, 0.7) / R), 0.03, 1.0) * 0.9;
      gl_PointSize = min(2.0 * R, 90.0); }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.75, d) * vA;
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * 0.9, a); }`,
});
const snowPts = new THREE.Points(snowGeo, snowMat); snowPts.frustumCulled = false; scene.add(snowPts);

// ---------- chimney smoke ----------
const NS = 60, smokeGeo = new THREE.BufferGeometry(), sseed = new Float32Array(NS);
for (let i = 0; i < NS; i++) sseed[i] = i / NS;
smokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
smokeGeo.setAttribute('s', new THREE.BufferAttribute(sseed, 1));
const smokeMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uT: { value: 0 }, uO: { value: Y(meta.chimney) }, uPx: { value: 800 } },
  vertexShader: `attribute float s; uniform float uT, uPx; uniform vec3 uO; varying float vA;
    void main(){ float a = fract(s + uT * 0.06); vec3 p = uO + vec3(0.6 * a + 0.15 * sin(a * 9.0 + s * 30.0), a * 3.2, -0.3 * a);
      vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.25 + 1.3 * a) * uPx / -mv.z; vA = smoothstep(0.0, 0.12, a) * (1.0 - a) * 0.22; }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0;
      gl_FragColor = vec4(0.62, 0.56, 0.58, smoothstep(1.0, 0.0, d) * vA); }`,
});
const smoke = new THREE.Points(smokeGeo, smokeMat); smoke.frustumCulled = false; scene.add(smoke);

// ---------- post ----------
let composer = null, bokeh = null;
if (POST) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, innerWidth, innerHeight); ao.blendIntensity = 0.8; composer.addPass(ao);
  bokeh = new BokehPass(scene, camera, { focus: 17, aperture: 0.00035, maxblur: 0.005 }); composer.addPass(bokeh);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.9));
  composer.addPass(new OutputPass());
}

// ---------- interaction: click the door ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let doorOpen = 0, doorTarget = 0;
const doorMeshes = []; door && door.traverse((o) => o.isMesh && doorMeshes.push(o));
renderer.domElement.addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera);
  renderer.domElement.style.cursor = ray.intersectObjects(doorMeshes, false).length ? 'pointer' : 'grab';
});
renderer.domElement.addEventListener('click', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mouse, camera);
  if (ray.intersectObjects(doorMeshes, false).length) doorTarget = doorTarget ? 0 : 1;
});
window.__openDoor = () => { doorTarget = 1; };

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; setFovFromHorizontal(fovH);
  renderer.setSize(innerWidth, innerHeight); composer && composer.setSize(innerWidth, innerHeight);
});

document.getElementById('loading')?.remove();
window.__toggleDoor = () => { doorTarget = doorTarget ? 0 : 1; };
const clock = new THREE.Clock(); let frames = 0, acc = 0, fps = 0;
if (STILL) {  // headless capture: render a few frames, time them honestly (gl.finish via readPixels), stop
  const n = +STILL, px = new Uint8Array(4), gl = renderer.getContext(); const times = [];
  if (Q.get('door')) doorTarget = doorOpen = 1;
  if (Q.get('along')) along = +Q.get('along');
  updateMarine(0.25);
  if (Q.get('follow')) { follow = true; for (let k = 0; k < 60; k++) updateFollow(0.5); }
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    controls.update(); snowMat.uniforms.uT.value = 3 + i / 24; smokeMat.uniforms.uT.value = 3 + i / 24;
    const pxs = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    snowMat.uniforms.uPx.value = pxs; smokeMat.uniforms.uPx.value = pxs;
    const fd = camera.position.distanceTo(controls.target) * 0.92; snowMat.uniforms.uFocus.value = fd; if (bokeh) bokeh.uniforms.focus.value = fd;
    if (door) door.rotation.y = THREE.MathUtils.degToRad(104) * doorOpen;
    composer ? composer.render(1 / 24) : renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    times.push(performance.now() - t0);
  }
  window.__frameMs = times.slice(1); window.__info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  window.__png = renderer.domElement.toDataURL('image/png'); window.__ready = true;
  throw new Error('still done');
}
const baseEmissive = shopGlow.map((m) => m.emissiveIntensity);
const baseInterior = interiorLights.map((l) => l.intensity);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 2.8); const e = tween.t * tween.t * (3 - 2 * tween.t);
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
    fovH = tween.f0 + (tween.f1 - tween.f0) * e; setFovFromHorizontal(fovH);
    if (tween.t >= 1) tween = null;
  }
  updateMarine(dt);
  if (follow) updateFollow(dt);
  controls.update();
  doorOpen += (doorTarget - doorOpen) * Math.min(1, dt * 2.2);
  if (door) door.rotation.y = THREE.MathUtils.degToRad(104) * doorOpen * doorOpen * (3 - 2 * doorOpen);
  const flick = 1 + 0.02 * Math.sin(t * 7.3) + 0.012 * Math.sin(t * 13.1);
  shopGlow.forEach((m, i) => { m.emissiveIntensity = baseEmissive[i] * flick * (1 + 0.45 * doorOpen); });
  interiorLights.forEach((l, i) => { l.intensity = baseInterior[i] * flick * (1 + 0.45 * doorOpen); });
  const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  snowMat.uniforms.uT.value = t; snowMat.uniforms.uPx.value = px; smokeMat.uniforms.uT.value = t; smokeMat.uniforms.uPx.value = px;
  const focusD = follow ? camera.position.distanceTo(marine.position) + 0.2 : camera.position.distanceTo(controls.target) * 0.92;
  snowMat.uniforms.uFocus.value = focusD;
  if (bokeh) bokeh.uniforms.focus.value = focusD;
  composer ? composer.render(dt) : renderer.render(scene, camera);
  frames++; acc += dt;
  if (acc > 0.5) { fps = frames / acc; frames = 0; acc = 0; }
  if (hud) hud.textContent = `${fps.toFixed(0)} fps · ${(tris / 1e6).toFixed(2)}M triangles`;
  window.__fps = fps; window.__ready = true;
});
