// Handmade Toy Town — style test host.
// One renderer and one camera rig; each style builds its own scene from the same layout. The camera, the
// Marine's position along his beat, and the time of day are shared, so the two treatments can be compared
// fairly: switch instantly, or drag a split line across the screen with both rendered from the same viewpoint.
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
import { CAMS, MARINE_PATH } from './layout.js';
import { buildPaper } from './paper/index.js';
import { buildFelt } from './felt/index.js';
import { buildTextile } from './textile/index.js';

const Q = new URLSearchParams(location.search + '&' + location.hash.slice(1));
const CAPTURE = Q.get('capture') === '1';
const ASSETS = window.HM_ASSETS || '../realtime/assets/';
const ui = window.HM_UI || {};
const status = (s) => ui.status && ui.status(s);

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
const DPR = Math.min(devicePixelRatio, Q.get('dpr') ? +Q.get('dpr') : 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 200);
let fovH = 50;
function setFovH(h) { fovH = h; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect)); camera.updateProjectionMatrix(); }
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.07;
controls.minDistance = 1.2; controls.maxDistance = 34; controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
let camName = Q.get('cam') && CAMS[Q.get('cam')] ? Q.get('cam') : 'Hero';
function placeCam(name) { const c = CAMS[name]; camera.position.fromArray(c.pos); controls.target.fromArray(c.target); setFovH(c.fovH); controls.update(); camName = name; }
placeCam(camName);
let tween = null;
let follow = false;
function goCam(name, instant = false) {
  const c = CAMS[name]; if (!c) return; camName = name; ui.cam && ui.cam(name);
  follow = !!c.follow; controls.enabled = !follow;
  if (follow) { tween = null; setFovH(c.fovH); if (instant) followCam(1); return; }
  if (instant) { tween = null; placeCam(name); return; }
  tween = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), f0: fovH, p1: new THREE.Vector3().fromArray(c.pos), t1: new THREE.Vector3().fromArray(c.target), f1: c.fovH };
}

// ------------------------------------------------------------------ styles
status('Loading the Marine’s rig…');
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function loadGLB(name) {
  const b64 = window.HM_B64 && window.HM_B64[name];
  if (b64) { const txt = await (await fetch(b64)).text(); return loader.parseAsync(Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0)).buffer, ''); }
  return loader.loadAsync(ASSETS + name);
}
const marine = await loadGLB('marine.glb');
const styles = {};
const want = (Q.get('style') || 'paper').toLowerCase();
const builders = { paper: buildPaper, felt: buildFelt, textile: buildTextile };
async function ensure(name) {
  if (styles[name]) return styles[name];
  status({ paper: 'Cutting and folding the paper village…', felt: 'Stitching the felt village…', textile: 'Sewing the textile storybook street…' }[name]);
  await new Promise((r) => setTimeout(r, 30));
  const t0 = performance.now();
  const s = builders[name]({ marine, renderer });
  s.buildMs = performance.now() - t0;
  setupPost(s);
  // walk clip, phase-locked to distance travelled
  s.walk = s.puppet.clips.Walk; s.walk.play();
  styles[name] = s;
  return s;
}
function setupPost(s) {
  const rt = new THREE.WebGLRenderTarget(innerWidth * DPR, innerHeight * DPR, { type: THREE.HalfFloatType, samples: 4 });
  const c = new EffectComposer(renderer, rt);
  c.addPass(new RenderPass(s.scene, camera));
  // the helper passes (AO normals, DOF depth) don't need the felt fibre shells: hide them there, show them again after
  const fuzz = []; s.scene.traverse((o) => { if (o.userData.fuzz || o.userData.helperSkip) fuzz.push(o); });
  const toggle = (v) => ({ enabled: true, needsSwap: false, clear: false, renderToScreen: false, setSize() {}, dispose() {}, render() { for (const f of fuzz) f.visible = v && (!f.userData.fuzz || f.geometry.instanceCount > 0); } });
  if (fuzz.length) c.addPass(toggle(false));
  if (Q.get('ao') !== '0') { const ao = new GTAOPass(s.scene, camera, innerWidth, innerHeight); ao.blendIntensity = s.ao ?? 0.9; ao.updateGtaoMaterial({ radius: s.aoRadius ?? 0.35, distanceExponent: 1.5, thickness: 1.0, scale: 1.0 }); c.addPass(ao); s.ao = ao; }
  s.bokehPass = new BokehPass(s.scene, camera, { focus: 15, aperture: s.bokeh ?? 0.0003, maxblur: 0.009 });
  if (Q.get('dof') !== '0') c.addPass(s.bokehPass);
  if (fuzz.length) c.addPass(toggle(true));
  c.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), s.bloom ?? 0.32, 0.55, 0.88));
  c.addPass(new OutputPass());
  s.composer = c;
}

// split view: both composers render off-screen, then a blit shows the left of one and the right of the other
const blit = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tA: { value: null }, tB: { value: null }, uX: { value: 0.5 }, uAspect: { value: 1 } }, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tA, tB; uniform float uX; varying vec2 vUv;
    void main(){ vec4 a = texture2D(tA, vUv), b = texture2D(tB, vUv); float d = vUv.x - uX;
      vec4 c = d < 0.0 ? a : b; float line = smoothstep(0.0025, 0.0, abs(d)); gl_FragColor = mix(c, vec4(0.98, 0.93, 0.82, 1.0), line * 0.9); }`,
}));
const blitScene = new THREE.Scene(); blitScene.add(blit); const blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

let mode = ['paper', 'felt', 'textile', 'split'].includes(want) ? want : 'paper';
let splitX = 0.5;
const pair = [(Q.get('left') || 'felt'), (Q.get('right') || 'textile')];     // the two styles shown in Compare

// ------------------------------------------------------------------ the Marine's beat (shared by both styles)
const path = new THREE.CatmullRomCurve3(MARINE_PATH.map(([x, z]) => new THREE.Vector3(x, 0.05, z)), true, 'centripetal');
const PATH_LEN = path.getLength(), STRIDE = 1.3, SPEED = 0.9;
let along = +(Q.get('along') || 0.04), walking = Q.get('walk') !== '0', twos = Q.get('twos') !== '0', animClock = 0;
function poseMarine(s, dt) {
  const p = path.getPointAt(along), ahead = path.getPointAt((along + 0.004) % 1);
  const tPose = twos ? Math.floor(animClock * 12) / 12 : animClock;          // stop-motion: re-posed 12 times a second
  const a2 = twos ? ((Math.floor(along * PATH_LEN / SPEED * 12) / 12) * SPEED / PATH_LEN) % 1 : along;
  const pp = path.getPointAt(a2);
  s.walk.timeScale = 1; s.walk.time = (tPose * SPEED / STRIDE * s.walk.getClip().duration) % s.walk.getClip().duration;
  s.puppet.mixer.update(0);
  if (s.puppet.afterPose) s.puppet.afterPose(s.walk.time / s.walk.getClip().duration);
  s.puppet.root.position.copy(walking ? pp : p);
  s.puppet.root.lookAt(ahead.x, (walking ? pp : p).y, ahead.z);
}

// a close, three-quarter view that walks along with the Marine (shows the puppet's construction)
const _fp = new THREE.Vector3(), _ft = new THREE.Vector3();
function followCam(k) {
  const p = path.getPointAt(along), ahead = path.getPointAt((along + 0.006) % 1), fwd = ahead.clone().sub(p).setY(0).normalize(), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
  _fp.copy(p).addScaledVector(fwd, 2.7).addScaledVector(side, -1.3).add(new THREE.Vector3(0, 1.55, 0));
  _ft.copy(p).add(new THREE.Vector3(0, 1.12, 0)).addScaledVector(fwd, 0.1);
  camera.position.lerp(_fp, k); controls.target.lerp(_ft, k); camera.lookAt(controls.target);
}

// ------------------------------------------------------------------ interaction
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pick(e) {
  const s = styles[activeStyle(e.clientX)]; if (!s) return null;
  ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  let best = null;
  for (const c of s.clickables) { const h = ray.intersectObjects(c.objects, true)[0]; if (h && (!best || h.distance < best.d)) best = { c, d: h.distance }; }
  return best && best.c;
}
function activeStyle(x) { return mode === 'split' ? (x / innerWidth < splitX ? pair[0] : pair[1]) : mode; }
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointermove', (e) => { renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab'; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const c = pick(e); if (!c) return;
  act(c.name);
});
function act(name) {   // interactions are applied to both styles, so the comparison stays like-for-like
  let msg = '';
  for (const s of Object.values(styles)) { const c = s.clickables.find((k) => k.name === name); if (c) msg = c.act(); }
  ui.toast && ui.toast(msg);
}

// ------------------------------------------------------------------ public hooks for the page and for tests
window.__hm = {
  async setMode(m) {
    if (m === 'split') { await ensure(pair[0]); await ensure(pair[1]); } else await ensure(m);
    mode = m; ui.mode && ui.mode(m); status(''); stats();
  },
  goCam, act, cams: CAMS,
  setSplit(x) { splitX = Math.min(0.97, Math.max(0.03, x)); },
  async setPair(a, b) { pair[0] = a; pair[1] = b; await ensure(a); await ensure(b); ui.pair && ui.pair(pair); },
  get pair() { return pair.slice(); },
  setWalking(v) { walking = v; }, setTwos(v) { twos = v; },
  /** felt fibres: number of fuzz shells (0 = off) — to compare the look and the cost */
  setFuzz(n) { if (n > 0 && Math.min(innerWidth, innerHeight) < 600) n = Math.min(n, 3); const s = styles.felt; if (!s) return; s.scene.traverse((o) => { if (o.userData.fuzz) { o.geometry.instanceCount = n; o.visible = n > 0; } }); s.setShells && s.setShells(n); stats(); },
  get mode() { return mode; },
  renderer, camera, controls, styles,
  /** headless: settle a still frame at time t (seconds) and return a JPEG data URL */
  async still(t = 4, q = 0.9) { renderFrame(t, 1 / 24, true); renderFrame(t, 1 / 24, true); return renderer.domElement.toDataURL('image/jpeg', q); },
  stats: () => stats(),
  /** measure: render n frames of the current view, forcing the GPU to finish each one; returns ms per frame (median) */
  timeFrames(n = 6) {
    const gl = renderer.getContext(), px = new Uint8Array(4), t = [];
    for (let i = 0; i < n; i++) { const t0 = performance.now(); renderFrame(4 + i / 24, 1 / 24, true); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b); return { ms: t[Math.floor(t.length / 2)], ...stats() };
  },
};

let lastInfo = { calls: 0, triangles: 0 };
function stats() {
  const info = lastInfo, s = styles[mode === 'split' ? pair[1] : mode];
  let tris = 0; s && s.scene.traverse((o) => { if (o.isMesh && o.geometry) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.geometry.isInstancedBufferGeometry ? (o.geometry.instanceCount || 1) : 1) * (o.isInstancedMesh ? o.count : 1); });
  const r = { calls: info.calls, drawnTris: info.triangles, sceneTris: Math.round(tris), buildMs: s ? Math.round(s.buildMs) : 0 };
  ui.stats && ui.stats(r); return r;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; setFovH(fovH); renderer.setSize(innerWidth, innerHeight);
  for (const s of Object.values(styles)) s.composer.setSize(innerWidth, innerHeight);
});

// ------------------------------------------------------------------ frame
const clock = new THREE.Clock(); let simT = 0, frames = 0, acc = 0;
function renderFrame(t, dt, still = false) {
  if (tween && !still) {
    tween.t = Math.min(1, tween.t + dt / 2.4); const e = tween.t * tween.t * (3 - 2 * tween.t);
    camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e); setFovH(tween.f0 + (tween.f1 - tween.f0) * e);
    if (tween.t >= 1) tween = null;
  }
  if (walking && !still) { along = (along + dt * SPEED / PATH_LEN) % 1; animClock += dt; }
  if (follow) followCam(still ? 1 : 1 - Math.exp(-dt * 3)); else controls.update();
  const focus = camera.position.distanceTo(controls.target);
  const list = mode === 'split' ? pair.slice() : [mode];
  for (const n of list) {
    const s = styles[n]; if (!s) continue;
    s.update(t, still ? 1 : dt); poseMarine(s, dt);
    s.bokehPass.uniforms.focus.value = focus; s.bokehPass.uniforms.aperture.value = s.bokeh ?? 0.0003;
    renderer.toneMappingExposure = s.exposure ?? 1;
  }
  renderer.info.autoReset = false; renderer.info.reset();
  if (mode === 'split' && styles[pair[0]] && styles[pair[1]]) {
    for (const n of pair) { const s = styles[n]; renderer.toneMappingExposure = s.exposure ?? 1; s.composer.renderToScreen = false; s.composer.render(dt); }
    blit.material.uniforms.tA.value = styles[pair[0]].composer.readBuffer.texture; blit.material.uniforms.tB.value = styles[pair[1]].composer.readBuffer.texture; blit.material.uniforms.uX.value = splitX;
    renderer.setRenderTarget(null); renderer.render(blitScene, blitCam);
  } else if (styles[mode]) { const s = styles[mode]; s.composer.renderToScreen = true; renderer.toneMappingExposure = s.exposure ?? 1; s.composer.render(dt); }
  lastInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };   // whole frame: shadows, scene, post passes
}

await window.__hm.setMode(mode);
ui.ready && ui.ready({ mode, cam: camName });
if (!CAPTURE) {
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1); simT += dt;
    renderFrame(simT, dt);
    frames++; acc += dt; if (acc > 1) { ui.fps && ui.fps(frames / acc); window.__fps = frames / acc; frames = 0; acc = 0; stats(); }
  });
}
window.__ready = true;
