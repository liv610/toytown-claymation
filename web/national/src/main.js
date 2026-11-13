// Railroad of Hope · national map prototype (step 1): a clay relief of the United States and a continuous
// descent into one detailed community (Maple Hollow, Ohio — fictional). Separate experiment; Toy Town and the
// existing journeys are untouched (Toy Town is linked from its place on the map).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { timeU, LOOK } from './clay.js';
import { loadGeography, toWorld, MAP_W, MAP_H } from './geo.js';
import { buildRelief } from './relief.js';
import { buildFeltRelief, threadScale } from './felt_relief.js';
import { createCommunity, S } from './community.js';
import { createChapter1, CH1 } from './chapter1.js';
import { fetchData } from '../../shared/data.js';
import { attachCampaignFocus } from './campaign_focus.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const ASSETS = window.NAT_ASSETS || './assets/';
const TOYTOWN_URL = window.NAT_TOYTOWN_URL || '../journey/';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, k) => a + (b - a) * k;
const tier = ['high', 'medium', 'low'].includes(Q.get('q')) ? Q.get('q') : (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700) ? 'medium' : 'high';
const status = (t) => { const s = $('status'); if (s) s.textContent = t; };
// the look: felt (the project's direction, default) or the original clay map (?look=clay, for comparison)
const FELT = (Q.get('look') || window.NAT_LOOK || 'felt') !== 'clay';
LOOK.felt = FELT;

// ------------------------------------------------------------------ renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: tier !== 'high', powerPreference: 'high-performance', preserveDrawingBuffer: Q.get('capture') === '1', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 1.5 : 1));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = tier !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-hidden', 'true');
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const sky = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  if (FELT) { gr.addColorStop(0, '#120e0d'); gr.addColorStop(0.55, '#221a18'); gr.addColorStop(0.85, '#33282a'); gr.addColorStop(1, '#161112'); }   // a museum gallery, dim round the lit display
  else { gr.addColorStop(0, '#1a2140'); gr.addColorStop(0.55, '#3a3552'); gr.addColorStop(0.85, '#8a5a50'); gr.addColorStop(1, '#2a1e1a'); } g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
scene.background = sky;
scene.fog = new THREE.FogExp2(0x6a6070, 0.0001);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.01, 8000);

// ------------------------------------------------------------------ world
status(FELT ? 'Sewing the country…' : 'Sculpting the country…');
// the felt map is the whole continent's middle: Canada, Mexico, Central America and the Caribbean around the US
const geo = await loadGeography(ASSETS + 'states-albers-10m.json', FELT ? { neighbours: await fetchData(ASSETS + 'neighbours-albers.json') } : {});
await new Promise((r) => setTimeout(r, 0));
const relief = (FELT ? buildFeltRelief : buildRelief)(scene, geo, { tier });
const site = geo.sites.maple, [sx, sz] = toWorld(...site.a);
const siteWorld = V(sx, geo.siteBase(site) + 0.25, sz);
status('Building Maple Hollow…');
const town = await createCommunity(scene, siteWorld, { assets: ASSETS, b64: window.NAT_B64, tier });
status('Gathering the townspeople…');
const ch1 = await createChapter1(town, { assets: ASSETS, b64: window.NAT_B64 });
const ttSite = geo.sites.toytown, [tx, tz] = toWorld(...ttSite.a);
const toyTownWorld = V(tx, geo.siteBase(ttSite) + 0.25, tz);
// Toy Town's place on the map: a little glowing hub where the lines meet (the real Toy Town is its own experience)
const hubGlow = new THREE.PointLight(0xffc070, 0, 40, 2); hubGlow.position.copy(toyTownWorld).add(V(0, 6, 0)); scene.add(hubGlow);
const star = FELT ? (() => {   // a stuffed gold felt star, glowing, where the routes meet
  const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 1.5 : 3.6; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r)); }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.8, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.45, bevelSegments: 3 }); g.center();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffd060, emissive: 0xffb030, emissiveIntensity: 1.4, roughness: 0.9 }));
})() : new THREE.Mesh(new THREE.OctahedronGeometry(2.2), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 1.6 }));
star.position.copy(toyTownWorld).add(V(0, 7, 0)); scene.add(star);

// ------------------------------------------------------------------ lights: golden hour over the map → blue hour in the street
const hemi = new THREE.HemisphereLight(0xdfe6ff, 0x6a5040, 0.7); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe0b8, 2.4); scene.add(key, key.target);
key.castShadow = tier !== 'low'; key.shadow.mapSize.set(tier === 'high' ? 4096 : 2048, tier === 'high' ? 4096 : 2048);
key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02;
const KEY_DIR = V(-0.55, 0.45, 0.7).normalize();

// ------------------------------------------------------------------ post
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: tier === 'high' ? 4 : 0 }));
composer.addPass(new RenderPass(scene, camera));
const gtao = tier === 'high' ? new GTAOPass(scene, camera, innerWidth, innerHeight) : null;
if (gtao) { gtao.blendIntensity = 0.75; composer.addPass(gtao); }
const bokeh = tier !== 'low' ? new BokehPass(scene, camera, { focus: 100, aperture: 0.0001, maxblur: 0.007 }) : null;
if (bokeh) composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.88); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ the camera rig: target, distance, heading, tilt
const rig = { target: V(0, 0, 18), dist: 1000, az: 0, el: THREE.MathUtils.degToRad(56) };
function nationalPose() {
  const aspect = innerWidth / innerHeight, fv = THREE.MathUtils.degToRad(camera.fov) / 2;
  const d = Math.max((MAP_H * 0.5) / Math.tan(fv), (MAP_W * 0.47) / (Math.tan(fv) * aspect));
  // the felt map is a museum diorama: seen from a three-quarter overhead angle, the whole display in view so its
  // height (mountains, trees, houses) reads; the clay map as before
  if (FELT) { const df = Math.max((MAP_H * 0.62) / Math.tan(fv), (MAP_W * 0.56) / (Math.tan(fv) * aspect)); return { target: V(25, 0, aspect < 1 ? 70 : 60), dist: df, az: 0, el: THREE.MathUtils.degToRad(aspect < 1 ? 58 : 50) }; }
  return { target: V(0, 0, aspect < 1 ? 10 : 22), dist: d, az: 0, el: THREE.MathUtils.degToRad(aspect < 1 ? 62 : 56) };
}
Object.assign(rig, nationalPose());
const NAT_MIN = 90, STREET_MIN = 6 * S, STREET_MAX = 140 * S;
let mode = 'national';                 // national | flying | town | story
// a wider lens near the ground, like a miniature-set camera; a longer one over the country
function fovFor(dist) { return lerp(innerWidth < innerHeight ? 64 : 50, 32, smooth((Math.log(dist) - Math.log(4)) / (Math.log(260) - Math.log(4)))); }
function applyRig() {
  const ce = Math.cos(rig.el);
  camera.position.set(rig.target.x + rig.dist * ce * Math.sin(rig.az), rig.target.y + rig.dist * Math.sin(rig.el), rig.target.z + rig.dist * ce * Math.cos(rig.az));
  camera.lookAt(rig.target);
  camera.fov = fovFor(rig.dist);
  camera.near = Math.max(0.004, rig.dist * 0.01); camera.far = Math.max(60, rig.dist * 8); camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------ the descent: one continuous move, even perceived zoom speed
let flight = null;
function makeFlight(from, to, dur, onDone) {
  const az0 = from.az, dAz = ((to.az - from.az + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return { t: 0, dur: REDUCED ? 0.0001 : dur, onDone, at(u) {
    const e = smoother(u), eT = smoother(Math.min(1, u * 1.35)), eTilt = smoother(clamp((u - 0.45) / 0.55));
    return {
      target: from.target.clone().lerp(to.target, eT),
      dist: Math.exp(lerp(Math.log(from.dist), Math.log(to.dist), e)),
      az: az0 + dAz * smoother(clamp((u - 0.3) / 0.7)),
      el: lerp(from.el, to.el, to.el < from.el ? eTilt : e),
    };
  } };
}
function snapshot() { return { target: rig.target.clone(), dist: rig.dist, az: rig.az, el: rig.el }; }
const campaignFlight = () => mode === 'flying' && flight && flight.campaign;   // a short move to a selected campaign
function descend() {
  if (mode === 'flying' && !campaignFlight()) return;
  mode = 'flying'; ui('flying-down');
  // land where Chapter 1 opens, then the chapter plays by itself (pause, skip and the help actions are always there)
  flight = makeFlight(snapshot(), rigFrom(ch1.shotWorld(0, REDUCED)), 7.5, () => startStory());
}
// a camera position + look-at point → the rig's target / distance / heading / tilt
function rigFrom({ pos, look }) {
  const d = pos.clone().sub(look), dist = d.length();
  return { target: look.clone(), dist, az: Math.atan2(d.x, d.z), el: Math.asin(d.y / dist) };
}
function ascend() {
  if (mode === 'flying' && !campaignFlight()) return;
  endStory();
  mode = 'flying'; ui('flying-up');
  flight = makeFlight(snapshot(), nationalPose(), 5.5, () => { mode = 'national'; ui('national'); });
}

// ------------------------------------------------------------------ Chapter 1: story clock, the visitor's tap, controls
// The clock stops at the box for at most HOLD_MAX seconds waiting for a tap on the toy; then it carries on by itself.
const HOLD_MAX = 4.5;
let story = null;                       // { t, playing, given, waited, ended }
function startStory() {
  mode = 'story'; story = { t: 0, playing: true, given: false, waited: 0, ended: false };
  ui('story'); storyUI();
}
function endStory() { story = null; $('givePrompt').hidden = true; $('endcard').hidden = true; $('storybar').hidden = true; }
function lookAround() { endStory(); mode = 'town'; ui('town'); }
function giveToy() { if (story && !story.given && story.t >= ch1.beats.hold - 0.01) { story.given = true; storyUI(); } }
function storyStep(dt) {
  if (story.playing && !story.ended) {
    const B = ch1.beats;
    if (story.t < B.hold || story.given) story.t = Math.min(B.end, story.t + dt);
    else { story.waited += dt; if (story.waited > HOLD_MAX) story.given = true; }
    if (story.t >= B.end) { story.ended = true; storyUI(); }
  }
  ch1.evaluate(story.t, timeU.value);
  Object.assign(rig, rigFrom(ch1.shotWorld(story.t, REDUCED))); applyRig(); camera.updateMatrixWorld();
  const waiting = story.t >= ch1.beats.hold - 0.01 && !story.given;
  $('caption').textContent = waiting ? 'Tap the toy to give it.' : ch1.caption(story.t);
  const gp = $('givePrompt'); gp.hidden = !waiting;
  // placed once, just below the toy when the story stops (a still target is easier to tap; it stays clear of the face)
  if (waiting && !story.promptAt) { const p = ch1.toyWorld().project(camera); story.promptAt = [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight + 34]; gp.style.transform = `translate(${story.promptAt[0].toFixed(1)}px, ${story.promptAt[1].toFixed(1)}px)`; }
}
function storyUI() {
  if (!story) return;
  $('storybar').hidden = story.ended; $('endcard').hidden = !story.ended;
  $('sPlay').textContent = story.playing ? 'Pause' : 'Play';
  $('sPlay').setAttribute('aria-pressed', String(!story.playing));
  if (story.ended) $('caption').textContent = '';
}
$('sPlay').onclick = () => { if (story) { story.playing = !story.playing; storyUI(); } };
$('sSkip').onclick = () => { if (story) { story.given = true; story.t = ch1.beats.end; story.ended = true; storyUI(); } };
for (const id of ['sReplay', 'eReplay']) $(id).onclick = () => startStory();
$('givePrompt').onclick = giveToy;
$('eLook').onclick = lookAround;
$('eMap').onclick = ascend;
$('playCh1').onclick = () => { mode = 'flying'; flight = makeFlight(snapshot(), rigFrom(ch1.shotWorld(0, REDUCED)), 1.6, () => startStory()); };
for (const id of ['sText', 'eText']) $(id).onclick = () => $('ch1text').showModal();
$('ch1textBody').innerHTML = CH1.text.map((p) => `<p>${p}</p>`).join('');
$('eNext').textContent = CH1.next;

// ------------------------------------------------------------------ direct manipulation (drag / wheel / pinch), never during a flight
const pointers = new Map(); let pinch0 = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode === 'story' && story && !story.given && story.t >= ch1.beats.hold - 0.01) { const p = ch1.toyWorld().project(camera); if (Math.hypot((p.x + 1) / 2 * innerWidth - e.clientX, (1 - p.y) / 2 * innerHeight - e.clientY) < 90) giveToy(); }
  pointers.set(e.pointerId, [e.clientX, e.clientY]); renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointerup', (e) => { pointers.delete(e.pointerId); pinch0 = 0; });
renderer.domElement.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch0 = 0; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || mode === 'flying' || mode === 'story') return;
  const [px, py] = pointers.get(e.pointerId), dx = e.clientX - px, dy = e.clientY - py; pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) zoom(pinch0 / d); pinch0 = d; return; }
  if (mode === 'national') {                       // pan the map under the finger
    const k = rig.dist / innerHeight * 1.1, c = Math.cos(rig.az), s = Math.sin(rig.az);
    // screen-right on the ground = (cos az, 0, -sin az); screen-up on the ground = (-sin az, 0, -cos az)
    const [bx0, by0, bx1, by1] = geo.board;   // the felt board is bigger (the neighbours); the clay map's board is the US frame
    rig.target.x = clamp(rig.target.x - dx * k * c - dy * k * s, bx0 - MAP_W / 2 - 20, bx1 - MAP_W / 2 + 20);
    rig.target.z = clamp(rig.target.z + dx * k * s - dy * k * c, by0 - MAP_H / 2 - 20, by1 - MAP_H / 2 + 20);
  } else {                                         // look around the town
    rig.az -= dx * 0.005; rig.el = clamp(rig.el + dy * 0.004, THREE.MathUtils.degToRad(4), THREE.MathUtils.degToRad(70));
  }
});
function zoom(f) {
  if (mode === 'national') rig.dist = clamp(rig.dist * f, NAT_MIN, nationalPose().dist * 1.15);
  else if (mode === 'town') rig.dist = clamp(rig.dist * f, STREET_MIN, STREET_MAX);
}
renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); if (mode !== 'flying' && mode !== 'story') zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

// ------------------------------------------------------------------ scale-aware look: lighting, haze, focus, occlusion, shadows
function atmosphere(t) {
  const k = smooth((Math.log(rig.dist) - Math.log(4)) / (Math.log(260) - Math.log(4)));   // 0 = street, 1 = national
  const dusk = 1 - k;
  // the felt picture map is warmly lit from above, like the reference; the clay map keeps its golden hour
  const W_ = FELT ? 1 : 0;
  key.intensity = lerp(0.55, 2.4 + 0.3 * W_, k); key.color.setRGB(lerp(0.75, 1.0, k), lerp(0.8, 0.88 + 0.04 * W_, k), lerp(1.0, 0.72 + 0.06 * W_, k));
  hemi.intensity = lerp(0.42, 0.72 + 0.28 * W_, k); hemi.color.setRGB(lerp(0.55, 0.88 + 0.12 * W_, k), lerp(0.62, 0.9 + 0.02 * W_, k), lerp(0.95, 1.0 - 0.18 * W_, k));
  renderer.toneMappingExposure = lerp(1.25, 1.1 + 0.1 * W_, k);
  scene.fog.color.setRGB(lerp(0.32, 0.42, k), lerp(0.33, 0.38, k), lerp(0.45, 0.42, k));
  scene.fog.density = 0.32 / (rig.dist * 7);
  const size = clamp(rig.dist * 0.85, 2.5, 640), sc = key.shadow.camera;
  key.target.position.copy(rig.target); key.position.copy(rig.target).addScaledVector(KEY_DIR, size * 2 + 20);
  Object.assign(sc, { left: -size, right: size, top: size, bottom: -size, near: 0.1, far: size * 5 + 60 }); sc.updateProjectionMatrix();
  if (bokeh) { bokeh.uniforms.focus.value = rig.dist; bokeh.uniforms.aperture.value = 0.006 / rig.dist; }
  if (gtao) gtao.updateGtaoMaterial({ radius: rig.dist * 0.02, thickness: rig.dist * 0.01 });
  const px = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  town.root.visible = rig.dist < 220;
  relief.setLineFade(smooth((Math.log(rig.dist) - Math.log(14)) / (Math.log(60) - Math.log(14))));
  town.setDusk(smooth((dusk - 0.35) / 0.65), t, px);
  hubGlow.intensity = lerp(0, FELT ? 160 : 900, k); star.rotation.y = t * 0.6;
  threadScale.value = lerp(0.05, 1, smooth((Math.log(rig.dist) - Math.log(12)) / (Math.log(420) - Math.log(12))));   // felt: floss slims on the way down
  if (relief.landmarks) relief.landmarks.setScale(smooth((Math.log(rig.dist) - Math.log(28)) / (Math.log(260) - Math.log(28))));   // picture-map icons recede on the way down
  // up close, lit windows fill much of the frame: keep their bloom from washing the scene out
  bloom.strength = lerp(0.12, 0.35, smooth((Math.log(rig.dist) - Math.log(0.4)) / (Math.log(6) - Math.log(0.4))));
}

// ------------------------------------------------------------------ pins + UI
const pins = [['pinMaple', () => siteWorld.clone().add(V(0, 3, 0))], ['pinToy', () => toyTownWorld.clone().add(V(0, 10, 0))]];
function placePins() {
  for (const [id, f] of pins) {
    const p = f().project(camera), el = $(id);
    const show = mode === 'national' && p.z < 1 && !flight;
    el.hidden = !show; if (!show) continue;
    el.style.transform = `translate(${((p.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - p.y) / 2 * innerHeight).toFixed(1)}px)`;
  }
}
const CAPTIONS = {
  national: FELT ? 'A miniature United States, sewn in felt. Three symbolic lines connect communities across the country.' : 'A miniature United States, sculpted in clay. Three symbolic lines connect communities across the country.',
  'flying-down': 'Maple Hollow, Ohio — a small town getting ready for the holidays.',
  town: 'Maple Hollow at dusk.',
  story: '',
  'flying-up': 'Back to the whole country…',
};
function ui(m) {
  $('caption').textContent = CAPTIONS[m];
  document.querySelector('.note').hidden = m !== 'national';
  $('descend').hidden = m !== 'national'; $('ascend').hidden = m !== 'town'; $('playCh1').hidden = m !== 'town';
  $('hint').textContent = m === 'town' ? 'Drag to look around · scroll or pinch to move closer' : m === 'national' ? 'Drag to move · scroll or pinch to zoom' : '';
}
$('descend').onclick = descend; $('pinMaple').onclick = descend; $('ascend').onclick = ascend;
$('pinToy').onclick = () => window.open(TOYTOWN_URL, '_blank', 'noopener');
// the ways-to-help bar and the dialogs' Close buttons are wired by the page shell (app.js), before the 3D map loads

// ------------------------------------------------------------------ campaign selection (Milestone 1): the finder selects, the map follows
// Only over the country view: during the descent, in Maple Hollow or in the story the selection is kept (the card stays
// open) but the camera does not move and the pin is not shown.
const campaigns = attachCampaignFocus({ scene, geo, relief, rig, camera, reduced: REDUCED, dom: renderer.domElement, minDist: NAT_MIN,
  regionalDist: () => nationalPose().dist, fovFor,
  canMove: () => mode === 'national' || campaignFlight(),
  fly: (pose) => { mode = 'flying'; flight = makeFlight(snapshot(), pose, 1.4, () => { mode = 'national'; }); flight.campaign = true; },
  showing: () => mode === 'national' || campaignFlight(), flying: () => !!campaignFlight() });

// "Back to the whole country": after the map has moved in (to a campaign, or the visitor zoomed), one tap restores the
// national framing. Over the country view only (never in the descent, Maple Hollow or the story); the campaign card and
// pin stay; reduced motion jumps. Like a campaign move, "Visit Maple Hollow" can interrupt it.
const wholeBtn = $('wholeCountry');
wholeBtn.onclick = () => {
  if (mode !== 'national' && !campaignFlight()) return;
  const back = document.activeElement === wholeBtn;
  mode = 'flying'; flight = makeFlight(snapshot(), nationalPose(), 1.4, () => { mode = 'national'; if (back) $('descend').focus(); }); flight.campaign = true;
};
function wholeCountryButton() {
  const show = mode === 'national' && !flight && rig.dist < nationalPose().dist * 0.7;
  if (wholeBtn.hidden === show) wholeBtn.hidden = !show;
}

// ------------------------------------------------------------------ loop
let last = performance.now(), paused = false;
function frame(dt) {
  timeU.value += dt;
  if (flight) {
    flight.t = Math.min(1, flight.t + dt / flight.dur);
    Object.assign(rig, flight.at(flight.t));
    if (flight.t >= 1) { const f = flight; flight = null; f.onDone(); }
  }
  if (mode === 'story' && story) storyStep(dt);
  applyRig(); atmosphere(timeU.value); relief.update(dt, timeU.value); placePins(); campaigns.update(); wholeCountryButton();
  composer.render(dt);
}
addEventListener('resize', () => { if (story) story.promptAt = null; camera.aspect = innerWidth / innerHeight; renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); if (mode === 'national') Object.assign(rig, nationalPose()); });
document.addEventListener('visibilitychange', () => { paused = document.hidden; });
$('status').remove();
ui('national');
if (Q.get('chapter') === '1' || location.hash === '#chapter1') { Object.assign(rig, rigFrom(ch1.shotWorld(0, REDUCED))); startStory(); }
renderer.setAnimationLoop((now) => { const dt = Math.min(0.1, (now - last) / 1000); last = now; if (!paused) frame(dt); });

// test hooks (no effect for visitors): pose the camera along the descent at u ∈ [0,1] and grab a frame
window.__nat = {
  shot(u) {
    renderer.setAnimationLoop(null);
    const f = makeFlight(nationalPose(), town.streetPose(), 1, () => {});
    Object.assign(rig, f.at(u)); mode = u >= 1 ? 'town' : u <= 0 ? 'national' : 'flying'; ui(u >= 1 ? 'town' : u <= 0 ? 'national' : 'flying-down');
    applyRig(); atmosphere(timeU.value + 3); relief.update(0, 12); placePins(); composer.render(0.016);
    return renderer.domElement.toDataURL('image/jpeg', 0.9);
  },
  pose(p) { renderer.setAnimationLoop(null); Object.assign(rig, p); applyRig(); atmosphere(3); relief.update(0, 12); composer.render(0.016); return renderer.domElement.toDataURL('image/jpeg', 0.9); },
  // Chapter 1 at story time t (given: whether the toy has been given yet)
  story(t, given = true) {
    renderer.setAnimationLoop(null);
    if (!story) startStory();
    Object.assign(story, { t, given, playing: false, ended: t >= ch1.beats.end, promptAt: null }); storyUI();
    timeU.value = 20 + t; storyStep(0); applyRig(); placePins(); atmosphere(timeU.value); relief.update(0, 12); composer.render(0.016);
    return renderer.domElement.toDataURL('image/jpeg', 0.9);
  },
  beats: () => ch1.beats,
  state: () => ({ mode, t: story && story.t, given: story && story.given, waited: story && story.waited, ended: story && story.ended }),
  campaign: () => campaigns.state(),
  project: (lon, lat) => campaigns.project(lon, lat),
  rig, siteWorld, S,
};
