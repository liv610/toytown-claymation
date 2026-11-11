// Storybook transition test: an illustrated national map whose community pops up into a clay diorama.
// One timeline (≈8 s) drives everything; forward = visit, backward = return to the map, and the
// scrubber can stop on any frame. Separate experiment: the national folk-art map and the Toy Town
// journeys are not touched.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { drawIllustratedMap, MAP_W, MAP_H, COMMUNITIES } from './mapart.js';
import { createPopupTown } from './popup_town.js';
import { timeU } from '../../journey/src/world/diorama.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const ASSETS = window.SB_ASSETS || './assets/';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, k) => a + (b - a) * k;
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Q.get('capture') === '1' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-hidden', 'true');
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a211b);                       // the page lies on a dark wooden desk
const camera = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 1, 6000);

// ------------------------------------------------------------------ the page (illustration: unlit, never tone-mapped)
$('status').textContent = 'Drawing the map…';
const art = await drawIllustratedMap(ASSETS + 'states-albers-10m.json');
const pageTex = new THREE.CanvasTexture(art.canvas); pageTex.colorSpace = THREE.SRGBColorSpace; pageTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const pageMat = new THREE.MeshBasicMaterial({ map: pageTex, toneMapped: false });
const page = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), pageMat); page.rotation.x = -Math.PI / 2; scene.add(page);
const desk = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W * 3, MAP_H * 3), new THREE.MeshBasicMaterial({ color: 0x2a211b, toneMapped: false }));
desk.rotation.x = -Math.PI / 2; desk.position.y = -0.6; scene.add(desk);
const mapToWorld = (x, y) => V(x - MAP_W / 2, 0, y - MAP_H / 2);

// ------------------------------------------------------------------ the community
const maple = COMMUNITIES.find((c) => c.id === 'maple');
const T = mapToWorld(maple.x, maple.y);
const town = createPopupTown(scene, T);
// a patch of clean paper under the town, so the map's label and icon don't show through the pop-up
const blankTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 60, 128, 128, 128); gr.addColorStop(0, 'rgba(239,226,198,1)'); gr.addColorStop(0.75, 'rgba(239,226,198,0.95)'); gr.addColorStop(1, 'rgba(239,226,198,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const blank = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshBasicMaterial({ map: blankTex, transparent: true, depthWrite: false, toneMapped: false }));
blank.rotation.x = -Math.PI / 2; blank.position.copy(T).add(V(0, 0.02, -1)); scene.add(blank);
// a warm glow marks the community on the map
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,220,150,1)'); gr.addColorStop(0.25, 'rgba(255,190,90,0.7)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
glow.position.copy(T).add(V(0, 2, 0)); scene.add(glow);

// ------------------------------------------------------------------ lights: storybook daylight → dusk
const hemi = new THREE.HemisphereLight(0xfff4e2, 0x8a7a6a, 1.25); scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0dc, 1.4);
key.position.copy(T).add(V(-30, 42, 26)); key.target.position.copy(T); scene.add(key, key.target);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
Object.assign(key.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 140 }); key.shadow.camera.updateProjectionMatrix();

// ------------------------------------------------------------------ post: just a soft bloom for lamps and windows
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.5, 0.86); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ camera: fit the page, then glide to the community
function mapPose() {
  const fovV = THREE.MathUtils.degToRad(28), aspect = innerWidth / innerHeight;
  const hNeed = (MAP_H * 1.12) / 2 / Math.tan(fovV / 2), wNeed = (MAP_W * 1.08) / 2 / (Math.tan(fovV / 2) * aspect);
  const h = Math.max(hNeed, wNeed);
  return { pos: V(0, h, h * 0.02), look: V(0, 0, 0), fov: 28 };
}
function townPose() {
  const portrait = innerWidth < innerHeight;
  return { pos: T.clone().add(portrait ? V(0, 9, 30) : V(0, 7.5, 24)), look: T.clone().add(V(0, 1.6, -3)), fov: portrait ? 46 : 40 };
}
let flight = null;
function buildFlight() {
  const M = mapPose(), E = townPose();
  const keys = [
    [0.0, M.pos, M.look, M.fov],
    [0.45, T.clone().add(V(0, 230, 40)), T.clone(), 30],
    [0.78, T.clone().add(V(0, 48, 46)), T.clone().add(V(0, 0, -2)), 34],
    [1.0, E.pos, E.look, E.fov],
  ];
  const pc = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal', 0.5);
  const lc = new THREE.CatmullRomCurve3(keys.map((k) => k[2]), false, 'centripetal', 0.5);
  flight = (u) => {
    const e = smoother(u); let i = 0; while (i < keys.length - 2 && e > keys[i + 1][0]) i++;
    const k = clamp((e - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
    return { pos: pc.getPointAt(e), look: lc.getPointAt(e), fov: lerp(keys[i][3], keys[i + 1][3], smooth(k)) };
  };
}
buildFlight();

// ------------------------------------------------------------------ the timeline (seconds)
const TOTAL = 8.2;
const BEATS = [[0, 'Maple Hollow, Ohio'], [0.6, 'A community lights up…'], [3.0, 'The page begins to unfold…'], [4.4, '…and the drawing becomes a little world.'], [6.0, 'Maple Hollow at dusk.']];
let t = 0, dir = 0, speed = 1, beat = -1;
function apply(x) {
  const f = flight(ramp(x, 0.5, 4.6));
  camera.position.copy(f.pos); camera.lookAt(f.look); camera.fov = f.fov; camera.updateProjectionMatrix();
  const near = ramp(x, 2.0, 3.2);
  town.setAppear(near);
  town.setPop(ramp(x, 3.0, 4.6));
  town.setReal(ramp(x, 4.3, 6.1));
  const d = smooth(ramp(x, 5.6, 7.4));
  town.setDusk(d, timeU.value);
  // the glow: strong on the map, gone once we're down in the town
  const pulse = 1 + 0.15 * Math.sin(performance.now() / 300);
  glow.material.opacity = (1 - near) * (0.55 + 0.45 * smooth(ramp(x, 0, 0.8)));
  glow.scale.setScalar(lerp(46, 14, smooth(ramp(x, 0.5, 2.5))) * pulse);
  // daylight storybook → dusk: the page dims around the lit town
  hemi.intensity = lerp(1.25, 0.32, d); hemi.color.setRGB(lerp(1.0, 0.55, d), lerp(0.96, 0.62, d), lerp(0.89, 0.95, d));
  key.intensity = lerp(1.4, 0.55, d); key.color.setRGB(1, lerp(0.94, 0.78, d), lerp(0.86, 0.6, d));
  pageMat.color.setScalar(lerp(1, 0.5, d));
  blank.material.opacity = smooth(ramp(x, 2.4, 3.3)); blank.material.color.setScalar(lerp(1, 0.5, d)); blank.visible = blank.material.opacity > 0.001;
  // captions
  let b = 0; for (let i = 0; i < BEATS.length; i++) if (x >= BEATS[i][0]) b = i;
  if (b !== beat) { beat = b; $('caption').textContent = BEATS[b][1]; }
  $('scrub').value = String(x);
}

// ------------------------------------------------------------------ controls
function play(d) { dir = d; if (REDUCED) { t = d > 0 ? TOTAL : 0; dir = 0; } sync(); }
function sync() {
  const atTown = t >= TOTAL - 0.001, atMap = t <= 0.001;
  $('visit').hidden = !(atMap || dir < 0) || dir > 0;
  $('back').hidden = !(atTown || dir > 0) || dir < 0;
  $('pause').hidden = dir === 0; $('resume').hidden = dir !== 0 || atTown || atMap;
  $('pin').hidden = !atMap || dir !== 0;
}
$('visit').onclick = () => play(1);
$('pin').onclick = () => play(1);
$('back').onclick = () => play(-1);
$('pause').onclick = () => { dir = 0; sync(); };
$('resume').onclick = () => { dir = t > TOTAL / 2 ? -1 : 1; play(dir); };
$('speed').onchange = (e) => { speed = +e.target.value; };
$('scrub').max = String(TOTAL);
$('scrub').oninput = (e) => { dir = 0; t = +e.target.value; sync(); };
// click the glowing community on the map
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  if (t > 0.001 || dir !== 0) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera);
  const h = ray.intersectObject(page)[0];
  if (h && h.point.distanceTo(T) < 22) play(1);
});
addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); dir === 0 ? $('resume').click() : $('pause').click(); } });

// the map pin follows the community on screen
function placePin() {
  const s = T.clone().add(V(0, 4, -10)).project(camera);
  $('pin').style.transform = `translate(${((s.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - s.y) / 2 * innerHeight).toFixed(1)}px)`;
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  timeU.value += dt;
  if (dir !== 0) {
    t = clamp(t + dir * dt * speed * (dir < 0 ? 1.25 : 1), 0, TOTAL);
    if (t === 0 || t === TOTAL) { dir = 0; sync(); }
  }
  apply(t); placePin();
  composer.render(dt);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  buildFlight();
});
$('status').remove();
sync();
renderer.setAnimationLoop(frame);
window.__sb = { seek: (x) => { dir = 0; t = x; sync(); apply(x); composer.render(0.016); return renderer.domElement.toDataURL('image/jpeg', 0.9); }, TOTAL, renderer };
