// Experiment C — assembles the mixed-media textile storybook street.
import * as THREE from 'three';
import { Batch, V, M, rect, roundRect, arch, rng, prim } from '../kit.js';
import { textileMaterial, threadMaterial, yarnMaterial, timeU } from './materials.js';
import { cardMaterial } from '../paper/materials.js';
import { makeKit, TF } from './kit.js';
import { shop, pinkHouse, holly, C } from './build.js';
import { tree, lamp, presents, street, garlands } from './props.js';
import { town } from './town.js';
import { SHOP, PINK, DOOR, TREE, LAMP } from '../layout.js';
import { textilePuppet } from './puppet.js';

export function buildTextile({ marine }) {
  const scene = new THREE.Scene();
  const HAZE = 0x3c3864;
  scene.background = new THREE.Color(HAZE);
  scene.fog = new THREE.FogExp2(HAZE, 0.019);
  const k = makeKit(21);
  const sk = { lights: new Batch('treeLights', 3), lamp: new Batch('lampGlow', 4) };
  const kb = makeKit(31);                 // the background: its own batches, no shadows, skipped by the AO/DOF helper passes
  shop(k); pinkHouse(k); tree(k, sk); const lampInfo = lamp(k, sk); presents(k); street(k); garlands(k, sk); town(k, kb, sk);

  const mats = {
    felt: textileMaterial('felt'), woven: textileMaterial('woven'), print: textileMaterial('print'), batt: textileMaterial('batt'),
    paint: textileMaterial('paint'), glow: textileMaterial('glow', { glow: 1.5, side: THREE.DoubleSide }), card: cardMaterial({ side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.32 }),
    bead: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
    thread: threadMaterial(),
  };
  const meshes = [];
  const add = (m, o) => { if (!m) return null; scene.add(m); meshes.push(m); return m; };
  for (const n of ['felt', 'woven', 'print', 'paint', 'card', 'metal', 'bead']) add(k.B[n].mesh(mats[n]));
  add(k.B.batt.mesh(mats.batt, { cast: true, receive: true }));
  { const gb = new (k.B.batt.constructor)('ground', 2); gb.add(sk.ground, null, 0xf4f2ee, { vary: 0 }); add(gb.mesh(mats.batt, { cast: false, receive: true })); }
  add(k.B.glow.mesh(mats.glow, { cast: false }));
  add(k.S.build(mats.thread));
  for (const n of ['felt', 'woven', 'print', 'paint', 'card', 'batt', 'glow']) { const m = add(kb.B[n].mesh(mats[n], { cast: false })); if (m) m.userData.helperSkip = true; }
  if (kb.S.items.length) add(kb.S.build(mats.thread)).userData.helperSkip = true;
  for (const y of k.yarns) { const m = new THREE.Mesh(y.g, yarnMaterial(y.color, y.twists)); m.castShadow = true; m.receiveShadow = true; add(m); }
  // tree lights (twinkle) and the lamp's fabric panes
  const beads = textileMaterial('glow', { glow: 2.8, name: 'treeLights' }); beads.userData.twinkle = { value: 1 };
  { const prev = beads.onBeforeCompile; beads.onBeforeCompile = (sh) => { prev(sh); sh.uniforms.uT = timeU; sh.uniforms.uTw = beads.userData.twinkle;
    sh.fragmentShader = sh.fragmentShader.replace('uniform float uLight;', 'uniform float uLight; uniform float uT; uniform float uTw;').replace('totalEmissiveRadiance *= uLight', 'totalEmissiveRadiance *= mix(1.0, 0.3 + 0.7 * step(0.35, fract(uT * 0.4 + vExtra * 7.0)), uTw) * uLight'); };
    beads.customProgramCacheKey = () => 'textile-beads'; }
  add(sk.lights.mesh(beads, { cast: false }));
  const lampMat = textileMaterial('glow', { glow: 2.2, side: THREE.DoubleSide, name: 'lampPanes' });
  add(sk.lamp.mesh(lampMat, { cast: false }));

  // the sky: twilight, blue-violet above, a rose-lavender glow at the horizon, a few stars
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vD; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main(){ float y = vD.y; vec3 zen = vec3(0.075, 0.08, 0.2), mid = vec3(0.2, 0.18, 0.36), hor = vec3(0.42, 0.33, 0.42);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, zen, smoothstep(0.18, 0.7, y));
        vec3 q = floor(vD * 260.0); float s = step(0.9975, h(q)) * smoothstep(0.12, 0.4, y); c += vec3(1.0, 0.92, 0.8) * s * 0.6;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  scene.add(sky);
  // a stuffed felt moon, high on the left, through the haze
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf3e6c4, fog: false }));
  moon.scale.set(1, 1, 0.3); moon.position.set(-24, 22, -55); scene.add(moon);

  // the hinged shop door: green felt, appliqué panels, a curtained light, a wooden knob, holly
  const dk = makeKit(23), w = DOOR.w - 0.02, h = DOOR.h - 0.02;
  dk.cut(roundRect(0, 0, w, h, 0.03), [roundRect(0.16, 1.42, w - 0.16, 1.98, 0.05)], M([0, 0, -TF / 2]), 0x3f6f57, { amp: 0.004 });
  for (const s of [1, -1]) for (const [px, py] of [[0.12, 0.18], [w - 0.48, 0.18], [0.12, 0.78], [w - 0.48, 0.78]]) {
    const z = s > 0 ? TF / 2 : -TF / 2 - 0.03, o = roundRect(px, py, px + 0.36, py + 0.5, 0.04);
    dk.cut(o, null, M([0, 0, z]), 0x2f5a45, { t: 0.03, bevel: 0.01, amp: 0.004 });
    if (s > 0) dk.S.running(M([0, 0, z + 0.032]), roundRect(px + 0.045, py + 0.045, px + 0.315, py + 0.455, 0.03), 0, 0x9ccab0, { closed: true, len: 0.04, gap: 0.028, r: 0.007 });
  }
  { const pos = [], idx = [], nx = 18; for (let j = 0; j <= 2; j++) for (let i = 0; i <= nx; i++) { const u = i / nx; pos.push(0.12 + u * (w - 0.24), 1.38 + j * 0.32, -0.01 - 0.02 * Math.abs(Math.sin(u * 7 * Math.PI))); } for (let j = 0; j < 2; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); dk.B.glow.add(g, null, 0xffc985, {}); }
  dk.cut(rect(0.16, 1.68, w - 0.16, 1.72), null, M([0, 0, TF / 2]), C.card, { batch: 'card', t: 0.02, amp: 0 });
  dk.cut(rect(w / 2 - 0.02, 1.42, w / 2 + 0.02, 1.98), null, M([0, 0, TF / 2]), C.card, { batch: 'card', t: 0.02, amp: 0 });
  dk.solid(new THREE.SphereGeometry(0.045, 10, 8), M([w - 0.14, 1.05, TF / 2 + 0.04]), C.gold, { batch: 'paint' });
  dk.S.blanket(M([0, 0, 0]), roundRect(0, 0, w, h, 0.03), TF / 2, C.thread, { step: 0.08, depth: 0.045 });
  holly(dk, M([w / 2, 2.1, TF / 2 + 0.02]), 4, 0.8);
  const doorPivot = new THREE.Group(); doorPivot.position.set(SHOP.x + DOOR.x - DOOR.w / 2 + 0.01, DOOR.y0 + 0.01, SHOP.z + TF / 2); doorPivot.rotation.set(-0.006, 0, 0.009); scene.add(doorPivot);
  const doorMeshes = [];
  for (const n of ['felt', 'woven', 'paint', 'card', 'glow', 'bead']) { const m = dk.B[n].mesh(mats[n]); if (m) { doorPivot.add(m); doorMeshes.push(m); } }
  if (dk.S.items.length) { const s = dk.S.build(mats.thread); doorPivot.add(s); doorMeshes.push(s); }

  // falling snow: small cotton puffs
  const N = 800, sg = new THREE.BufferGeometry(), seed = new Float32Array(N * 4), r = rng(9);
  for (let i = 0; i < N; i++) seed.set([r() * 30 - 14, r() * 13, r() * 18 - 10, r()], i * 4);
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); sg.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: timeU, uPx: { value: 800 } },
    vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vA;
      void main(){ vec3 p = seed.xyz; float H = 13.0; p.y = mod(p.y - (0.35 + 0.2 * seed.w) * uT, H) - 0.4;
        p.x += 0.35 * sin(uT * (0.3 + seed.w) + seed.w * 40.0); p.z += 0.2 * cos(uT * (0.27 + 0.5 * seed.w) + seed.w * 17.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((0.045 + 0.035 * fract(seed.w * 13.0)) * uPx / -mv.z, 1.2, 40.0); vA = 0.85 * clamp(1.4 - length(mv.xyz) / 40.0, 0.2, 1.0); }`,
    fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0; float a = smoothstep(1.0, 0.35, d) * vA;
      gl_FragColor = vec4(vec3(0.97, 0.96, 0.95), a); }`,
  });
  const snow = new THREE.Points(sg, snowMat); snow.frustumCulled = false; scene.add(snow);

  // ---------------------------------------------------------------- light: twilight outside, amber inside
  scene.add(new THREE.HemisphereLight(0x8088d4, 0x3e3048, 0.6));
  const moonKey = new THREE.DirectionalLight(0xb4bcff, 1.35);           // soft, cool, from high on the left: reveals the layers
  moonKey.position.set(-12, 15, 9); moonKey.target.position.set(1, 1, -1);
  moonKey.castShadow = true; moonKey.shadow.mapSize.set(2048, 2048);
  Object.assign(moonKey.shadow.camera, { left: -14, right: 14, top: 12, bottom: -8, near: 2, far: 45 });
  moonKey.shadow.bias = -0.0004; moonKey.shadow.normalBias = 0.025; moonKey.shadow.radius = 5;
  scene.add(moonKey, moonKey.target);
  const pl = (x, y, z, i, d, c = 0xffb066) => { const p = new THREE.PointLight(c, i, d, 2); p.position.set(x, y, z); scene.add(p); return p; };
  const inside = pl(0, 1.75, -0.22, 6.0, 3.0, 0xffb070); inside.userData.base = 6.0;              // the shop: display boxes and the room behind the door
  const shopSpill = pl(0, 2.1, 1.7, 2.2, 4.5, 0xffb468);                                        // window light on the pavement and the awning's underside
  pl(PINK.x - 0.3, 2.2, PINK.z + 1.5, 1.3, 4.0, 0xffae66);
  pl(TREE.x + 0.3, 1.5, TREE.z + 1.1, 1.0, 3.0, 0xffb878);
  const lampLight = new THREE.PointLight(0xffb468, 5.5, 9, 2); lampLight.position.copy(lampInfo.light);
  lampLight.castShadow = true; lampLight.shadow.autoUpdate = false; lampLight.shadow.needsUpdate = true; lampLight.shadow.mapSize.set(512, 512); lampLight.shadow.bias = -0.002; lampLight.shadow.radius = 6; scene.add(lampLight);

  // ---------------------------------------------------------------- puppet
  const puppet = textilePuppet(marine, { ...mats, felt: textileMaterial('felt', { scaleMul: 2.2, name: 'puppetFelt' }), woven: textileMaterial('woven', { scaleMul: 4.5, name: 'puppetCotton' }) });
  scene.add(puppet.root);

  // ---------------------------------------------------------------- interactions (the same three as the other styles)
  const state = { door: 0, doorT: 0, lamp: 1, lampT: 1, tree: 1 };
  const hitLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, LAMP.h + 0.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitLamp.position.set(LAMP.x, (LAMP.h + 0.3) / 2, LAMP.z); scene.add(hitLamp);
  const hitTree = new THREE.Mesh(new THREE.ConeGeometry(1.3, TREE.h + 0.4, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hitTree.position.set(TREE.x, (TREE.h + 0.4) / 2 + 0.2, TREE.z); scene.add(hitTree);
  const clickables = [
    { name: 'door', objects: doorMeshes, act: () => { state.doorT = state.doorT ? 0 : 1; return state.doorT ? 'The shop door swings open' : 'The shop door closes'; } },
    { name: 'lamp', objects: [hitLamp], act: () => { state.lampT = state.lampT ? 0 : 1; return state.lampT ? 'The lamplighter lights the lamp' : 'The lamp goes out'; } },
    { name: 'tree', objects: [hitTree], act: () => { state.tree = state.tree ? 0 : 1; beads.userData.twinkle.value = state.tree; return state.tree ? 'The tree lights twinkle' : 'The tree lights hold steady'; } },
  ];
  const baseLamp = lampLight.intensity;
  function update(t, dt) {
    timeU.value = t;
    state.door += (state.doorT - state.door) * Math.min(1, dt * 2.2);
    if (Math.abs(state.doorT - state.door) > 1e-3) lampLight.shadow.needsUpdate = true;
    const e = state.door * state.door * (3 - 2 * state.door);
    doorPivot.rotation.y = THREE.MathUtils.degToRad(100) * e;
    state.lamp += (state.lampT - state.lamp) * Math.min(1, dt * 4);
    const flick = 1 + 0.02 * Math.sin(t * 7.3) + 0.012 * Math.sin(t * 13.1);
    lampLight.intensity = baseLamp * state.lamp * flick; lampMat.userData.light.value = 0.12 + 0.88 * state.lamp * flick;
    inside.intensity = inside.userData.base * (0.75 + 0.6 * e);
    snowMat.uniforms.uPx.value = innerHeight * Math.min(devicePixelRatio, 1.5) / (2 * Math.tan(THREE.MathUtils.degToRad(40) / 2));
  }
  return { name: 'textile', scene, update, clickables, puppet, meshes, exposure: 1.08, bokeh: 0.00045, bloom: 0.16, aoRadius: 0.3, ao: 0.75 };
}
