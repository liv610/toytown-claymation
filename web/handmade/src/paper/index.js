// Experiment A — assembles the paper scene: batches → meshes, lights, sky, falling paper snow, interactions.
import * as THREE from 'three';
import { Batch, V, M, GLSL_NOISE } from '../kit.js';
import { cardMaterial, vellumMaterial, confettiMaterial, timeU } from './materials.js';
import { makeKit, shop, pinkHouse, T } from './build.js';
import { tree, lamp, presents, street, backdrop, door } from './props.js';
import { SHOP, PINK, DOOR, TREE, LAMP } from '../layout.js';
import { paperPuppet } from './puppet.js';

export function buildPaper({ marine }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f22);
  const k = makeKit(7);
  const sk = { lights: new Batch('treeLights', 3), lamp: new Batch('lampGlow', 4), stars: new Batch('stars', 5) };
  shop(k); pinkHouse(k);
  const treeInfo = tree(k, sk), lampInfo = lamp(k, sk);
  presents(k); street(k); backdrop(k, sk);

  const card = cardMaterial(), foil = cardMaterial({ roughness: 0.38, metalness: 0.75, tooth: 0.5, name: 'foil' });
  const vellum = vellumMaterial({ strength: 1.5 });
  const meshes = [];
  const add = (m) => { if (m) { scene.add(m); meshes.push(m); } return m; };
  add(k.B.card.mesh(card)); add(k.B.foil.mesh(foil));
  const vel = add(k.B.vellum.mesh(vellum, { cast: false }));

  // tree lights (twinkle), lamp panes (switchable), stars
  const beadMat = vellumMaterial({ color: 0xffcf8a, strength: 3.2, name: 'beads' });
  beadMat.userData.twinkle = { value: 1 };
  const twinkle = (m) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh) => { prev(sh); sh.uniforms.uT = timeU; sh.uniforms.uTw = m.userData.twinkle;
    sh.fragmentShader = sh.fragmentShader.replace('uniform float uLight;', 'uniform float uLight; uniform float uT; uniform float uTw;')
      .replace('totalEmissiveRadiance *= vColor.rgb', 'totalEmissiveRadiance *= mix(1.0, 0.25 + 0.75 * step(0.35, fract(uT * 0.45 + vExtra * 7.0)), uTw) * vColor.rgb'); };
    m.customProgramCacheKey = () => 'paper-beads'; };
  twinkle(beadMat);
  add(sk.lights.mesh(beadMat, { cast: false }));
  const lampMat = vellumMaterial({ color: 0xffc77a, strength: 2.6, name: 'lampPanes' });
  add(sk.lamp.mesh(lampMat, { cast: false }));
  const starMat = vellumMaterial({ color: 0xfff2cf, strength: 2.2, name: 'stars' });
  add(sk.stars.mesh(starMat, { cast: false, receive: false }));
  const treeStar = new THREE.Mesh(sk.star, new THREE.MeshStandardMaterial({ color: 0xe0ad48, metalness: 0.8, roughness: 0.32, emissive: 0x6a4a10, emissiveIntensity: 0.4, flatShading: true }));
  treeStar.applyMatrix4(sk.starMatrix); treeStar.castShadow = true; scene.add(treeStar);

  // sky: a painted curved board (watercolour wash on paper)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: GLSL_NOISE + `varying vec2 vUv; varying vec3 vP;
      void main(){ float y = vUv.y; vec3 top = vec3(0.020, 0.024, 0.070), mid = vec3(0.045, 0.050, 0.130), low = vec3(0.16, 0.10, 0.16);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.35, y)); c = mix(c, top, smoothstep(0.35, 1.0, y));
        float wash = fbm3(vP * 0.12) * 0.6 + fbm3(vP * 0.5) * 0.4; c *= 0.8 + 0.45 * wash;
        float bloom = smoothstep(0.55, 0.85, fbm3(vP * 0.07 + 3.0)); c = mix(c, c * vec3(1.25, 1.1, 1.35), bloom * 0.5);
        c *= 0.97 + 0.06 * vn3(vP * 18.0);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(sk.sky.geo, skyMat); sky.applyMatrix4(sk.sky.matrix); scene.add(sky);
  // the table the diorama stands on
  const table = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.9 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.31; table.receiveShadow = true; scene.add(table);

  // the hinged shop door
  const dk = makeKit(17); door(dk);
  const doorPivot = new THREE.Group(); doorPivot.position.set(SHOP.x + DOOR.x - DOOR.w / 2 + 0.01, DOOR.y0 + 0.01, SHOP.z + T / 2); scene.add(doorPivot);
  const doorMeshes = [dk.B.card.mesh(card), dk.B.foil.mesh(foil), dk.B.vellum.mesh(vellum, { cast: false })].filter(Boolean);
  doorMeshes.forEach((m) => doorPivot.add(m));

  // falling snow: tumbling paper scraps
  const N = 1000, flake = new THREE.CircleGeometry(0.036, 6), ig = new THREE.InstancedBufferGeometry();
  ig.index = flake.index; ig.attributes.position = flake.attributes.position; ig.attributes.normal = flake.attributes.normal;
  const seeds = new Float32Array(N * 4); for (let i = 0; i < N; i++) seeds.set([Math.random() * 26 - 12, Math.random() * 13, Math.random() * 15 - 9.5, Math.random()], i * 4);
  ig.setAttribute('aSnow', new THREE.InstancedBufferAttribute(seeds, 4)); ig.instanceCount = N;
  const snow = new THREE.Mesh(ig, confettiMaterial()); snow.frustumCulled = false; scene.add(snow);

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0x5c68a8, 0x3a2a30, 0.55));
  const key = new THREE.DirectionalLight(0xffd6a6, 2.4);
  key.position.set(-11, 14, 13); key.target.position.set(1, 1, -1);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 2, far: 50 });
  key.shadow.bias = -0.0002; key.shadow.normalBias = 0.012; key.shadow.radius = 3;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x8fa4ff, 0.7); rim.position.set(9, 10, -14); scene.add(rim);
  const spill = (x, y, z, i, d, c = 0xffb060) => { const p = new THREE.PointLight(c, i, d, 2); p.position.set(x, y, z); scene.add(p); return p; };
  const shopSpill = [spill(-1.65, 1.7, 0.7, 2.2, 3.2), spill(1.65, 1.7, 0.7, 2.2, 3.2), spill(0, 4.4, 0.8, 1.2, 3.0), spill(PINK.x, 2.5, PINK.z + 0.9, 1.8, 3.2), spill(PINK.x - 0.8, 1.4, PINK.z + 1.2, 1.5, 2.5)];
  const inside = spill(0, 2.4, -1.4, 4.0, 4.5, 0xffa458); inside.userData.base = 4.0;
  const lampLight = new THREE.PointLight(0xffb468, 7.0, 10, 2); lampLight.position.copy(lampInfo.light);
  lampLight.castShadow = true; lampLight.shadow.autoUpdate = false; lampLight.shadow.needsUpdate = true; lampLight.shadow.mapSize.set(1024, 1024);   // static: re-rendered only when something near it changes lampLight.shadow.bias = -0.002; lampLight.shadow.radius = 4; scene.add(lampLight);
  const treeLight = spill(TREE.x + 0.4, 1.8, TREE.z + 1.3, 1.6, 3.4, 0xffb070);

  // ---------------------------------------------------------------- puppet
  const puppet = paperPuppet(marine, { card, foil });
  scene.add(puppet.root);

  // ---------------------------------------------------------------- interactions
  const state = { door: 0, doorT: 0, lamp: 1, lampT: 1, tree: 1 };
  const hitLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, LAMP.h + 0.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitLamp.position.set(LAMP.x, (LAMP.h + 0.3) / 2, LAMP.z); scene.add(hitLamp);
  const hitTree = new THREE.Mesh(new THREE.ConeGeometry(1.3, TREE.h + 0.4, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hitTree.position.set(TREE.x, (TREE.h + 0.4) / 2 + 0.2, TREE.z); scene.add(hitTree);
  const clickables = [
    { name: 'door', objects: doorMeshes, act: () => { state.doorT = state.doorT ? 0 : 1; return state.doorT ? 'The shop door swings open' : 'The shop door closes'; } },
    { name: 'lamp', objects: [hitLamp], act: () => { state.lampT = state.lampT ? 0 : 1; return state.lampT ? 'The lamplighter lights the lamp' : 'The lamp goes out'; } },
    { name: 'tree', objects: [hitTree], act: () => { state.tree = state.tree ? 0 : 1; beadMat.userData.twinkle.value = state.tree; return state.tree ? 'The tree lights twinkle' : 'The tree lights hold steady'; } },
  ];
  const baseLamp = lampLight.intensity;
  function update(t, dt) {
    timeU.value = t;
    state.door += (state.doorT - state.door) * Math.min(1, dt * 2.2);
    const e = state.door * state.door * (3 - 2 * state.door);
    doorPivot.rotation.y = THREE.MathUtils.degToRad(100) * e;
    state.lamp += (state.lampT - state.lamp) * Math.min(1, dt * 4);
    if (Math.abs(state.doorT - state.door) > 1e-3) lampLight.shadow.needsUpdate = true;
    const flick = 1 + 0.025 * Math.sin(t * 7.3) + 0.015 * Math.sin(t * 13.1);
    lampLight.intensity = baseLamp * state.lamp * flick; lampMat.userData.light.value = 0.12 + 0.88 * state.lamp * flick;
    inside.intensity = inside.userData.base * (0.5 + 0.8 * e);
    treeStar.rotation.y = 0.3 + 0.15 * Math.sin(t * 0.6);
  }
  return { name: 'paper', scene, update, clickables, puppet, meshes, focusBias: 1.0, exposure: 1.12, bokeh: 0.0005 };
}
