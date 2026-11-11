// Experiment B — assembles the felt scene: batches → meshes (+ fuzz shells), stitches, fabric presents, lights,
// the cloth sky, falling wool snow and the interactions.
import * as THREE from 'three';
import { Batch, V, M, GLSL_NOISE, rng } from '../kit.js';
import { feltMaterial, fuzzMaterial, makeFuzz, threadMaterial, fabricMaterial, feltTexture, fuzzU, timeU } from './materials.js';
import { makeFeltKit, FT } from './kit.js';
import { shop, pinkHouse } from './build.js';
import { tree, lamp, presents, street, backdrop, door } from './props.js';
import { SHOP, PINK, DOOR, TREE, LAMP } from '../layout.js';
import { feltPuppet } from './puppet.js';

export function buildFelt({ marine }) {
  const Q = new URLSearchParams(location.search + '&' + location.hash.slice(1));
  fuzzU.shells.value = Q.get('fuzz') !== null ? Math.max(0, +Q.get('fuzz')) : (Math.min(innerWidth, innerHeight) < 600 ? 3 : 5);   // fewer fibre shells on phones
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1024);
  const k = makeFeltKit(11);
  const sk = { lights: new Batch('treeLights', 3), lamp: new Batch('lampGlow', 4), ribbon: new Batch('ribbon', 6), gifts: [] };
  shop(k); pinkHouse(k);
  tree(k, sk); const lampInfo = lamp(k, sk); presents(k, sk); street(k); backdrop(k, sk);

  const felt = feltMaterial(), wool = feltMaterial({ name: 'wool', scale: 3.2, bump: 0.01, sheen: 1.0 }), glow = feltMaterial({ name: 'glowFelt', glow: 1.25 });
  const fuzz = fuzzMaterial(), woolFuzz = fuzzMaterial({ scale: 3.2, density: 1.25 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.32 });
  const bead = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const thread = threadMaterial();
  const meshes = [];
  const add = (m, fz) => { if (!m) return null; scene.add(m); meshes.push(m); if (fz && fuzzU.shells.value > 0) { const f = makeFuzz(m, fz); scene.add(f); meshes.push(f); } return m; };
  add(k.B.felt.mesh(felt), fuzz); add(k.B.flat.mesh(felt)); add(k.B.wool.mesh(wool), woolFuzz); add(k.B.glow.mesh(glow, { cast: false }));
  add(k.B.metal.mesh(metal)); add(k.B.bead.mesh(bead));
  add(k.S.build(thread));
  // presents: woven fabric, satin ribbon
  for (const g of sk.gifts) { const m = new THREE.Mesh(g.geo, fabricMaterial(g.c1, g.c2, { pattern: g.pattern, check: g.pattern === 'gingham' ? 0.075 : 0.12 })); m.applyMatrix4(g.matrix); m.castShadow = m.receiveShadow = true; scene.add(m); }
  const satin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, sheen: 1, sheenRoughness: 0.25, sheenColor: new THREE.Color(1, 0.9, 0.85) });
  add(sk.ribbon.mesh(satin));
  // tree lights (twinkling felt balls lit from inside), the lamp's golden felt panes
  const beadGlow = feltMaterial({ name: 'treeLights', glow: 3.0 });
  beadGlow.userData.twinkle = { value: 1 };
  { const prev = beadGlow.onBeforeCompile; beadGlow.onBeforeCompile = (sh) => { prev(sh); sh.uniforms.uT = timeU; sh.uniforms.uTw = beadGlow.userData.twinkle;
    sh.fragmentShader = sh.fragmentShader.replace('uniform float uLight;', 'uniform float uLight; uniform float uT; uniform float uTw;')
      .replace('totalEmissiveRadiance *= uLight', 'totalEmissiveRadiance *= mix(1.0, 0.25 + 0.75 * step(0.35, fract(uT * 0.45 + vExtra * 7.0)), uTw) * uLight'); };
    beadGlow.customProgramCacheKey = () => 'felt-beads'; }
  add(sk.lights.mesh(beadGlow, { cast: false }));
  const lampMat = feltMaterial({ name: 'lampPanes', glow: 2.4, side: THREE.DoubleSide });
  add(sk.lamp.mesh(lampMat, { cast: false }));

  // the sky: a dark-blue cotton backdrop, gently gathered, with a woven texture
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: {},
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; vec3 p = position; p += normal * 0.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: GLSL_NOISE + `varying vec2 vUv; varying vec3 vP;
      void main(){ float y = vUv.y; vec3 top = vec3(0.02, 0.025, 0.07), mid = vec3(0.05, 0.055, 0.13), low = vec3(0.15, 0.10, 0.16);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.35, y)); c = mix(c, top, smoothstep(0.35, 1.0, y));
        float fold = 0.5 + 0.5 * sin(atan(vP.x, vP.z) * 70.0 + 2.0 * fbm3(vP * 0.2));     // gathered folds of the cloth
        c *= 0.86 + 0.2 * fold;
        vec2 w = fract(vec2(atan(vP.x, vP.z) * 1400.0, vP.y * 220.0)); c *= 0.94 + 0.08 * step(0.5, w.x) * step(0.5, w.y);
        c *= 0.92 + 0.12 * fbm3(vP * 0.6);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(sk.sky.geo, skyMat); sky.applyMatrix4(sk.sky.matrix); scene.add(sky);
  const table = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x1a1214, roughness: 0.9 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.31; table.receiveShadow = true; scene.add(table);

  // the hinged door
  const dk = makeFeltKit(23); door(dk);
  const doorPivot = new THREE.Group(); doorPivot.position.set(SHOP.x + DOOR.x - DOOR.w / 2 + 0.01, DOOR.y0 + 0.01, SHOP.z + FT / 2); scene.add(doorPivot);
  const doorMeshes = [];
  for (const [m, fz] of [[dk.B.felt.mesh(felt), fuzz], [dk.B.glow.mesh(glow), null], [dk.B.metal.mesh(metal), null], [dk.B.bead.mesh(bead), null], [dk.S.items.length ? dk.S.build(thread) : null, null]]) {
    if (!m) continue; doorPivot.add(m); doorMeshes.push(m); if (fz && fuzzU.shells.value > 0) doorPivot.add(makeFuzz(m, fz));
  }

  // falling snow: little puffs of wool (soft sprites with a fibrous edge)
  const N = 1100, sg = new THREE.BufferGeometry(), seed = new Float32Array(N * 4), r = rng(9);
  for (let i = 0; i < N; i++) seed.set([r() * 26 - 12, r() * 13, r() * 15 - 9.5, r()], i * 4);
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); sg.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const puffTex = (() => { const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d'); const rr = rng(4);
    for (let i = 0; i < 260; i++) { const a = rr() * Math.PI * 2, d = rr() * n * 0.28, x = n / 2 + Math.cos(a) * d, y = n / 2 + Math.sin(a) * d, b = a + (rr() - 0.5) * 3, L = 4 + rr() * 12;
      g.strokeStyle = `rgba(255,255,255,${0.25 + rr() * 0.35})`; g.lineWidth = 0.8 + rr(); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(b) * L, y + Math.sin(b) * L, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); return t; })();
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: timeU, uPx: { value: 800 }, tPuff: { value: puffTex } },
    vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vA; varying float vR;
      void main(){ vec3 p = seed.xyz; float H = 13.0; p.y = mod(p.y - (0.4 + 0.25 * seed.w) * uT, H) - 0.4;
        p.x += 0.4 * sin(uT * (0.35 + seed.w) + seed.w * 40.0); p.z += 0.25 * cos(uT * (0.3 + 0.5 * seed.w) + seed.w * 17.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vR = seed.w * 6.28;
        gl_PointSize = clamp((0.07 + 0.06 * fract(seed.w * 13.0)) * uPx / -mv.z, 1.5, 60.0); vA = 0.9; }`,
    fragmentShader: `uniform sampler2D tPuff; varying float vA; varying float vR;
      void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); q = mat2(c, -s, s, c) * q; vec4 t = texture2D(tPuff, q + 0.5);
        gl_FragColor = vec4(vec3(0.96, 0.95, 0.92), t.a * vA); }`,
  });
  const snow = new THREE.Points(sg, snowMat); snow.frustumCulled = false; scene.add(snow);

  // ---------------------------------------------------------------- lights: the same rig as the paper set, softer
  scene.add(new THREE.HemisphereLight(0x6670b0, 0x3a2a30, 0.7));
  const key = new THREE.DirectionalLight(0xffd6a6, 2.3);
  key.position.set(-11, 14, 13); key.target.position.set(1, 1, -1);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 2, far: 50 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03; key.shadow.radius = 5;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x9fb0ff, 0.9); rim.position.set(9, 10, -14); scene.add(rim);
  const spill = (x, y, z, i, d, c = 0xffb060) => { const p = new THREE.PointLight(c, i, d, 2); p.position.set(x, y, z); scene.add(p); return p; };
  spill(-1.65, 1.7, 0.9, 2.0, 3.2); spill(1.65, 1.7, 0.9, 2.0, 3.2); spill(0, 4.4, 0.9, 1.1, 3.0); spill(PINK.x, 2.5, PINK.z + 1.0, 1.6, 3.2); spill(PINK.x - 0.8, 1.4, PINK.z + 1.4, 1.4, 2.5);
  const inside = spill(0, 2.4, -1.4, 4.0, 4.5, 0xffa458); inside.userData.base = 4.0;
  const lampLight = new THREE.PointLight(0xffb468, 7.0, 10, 2); lampLight.position.copy(lampInfo.light);
  lampLight.castShadow = true; lampLight.shadow.autoUpdate = false; lampLight.shadow.needsUpdate = true; lampLight.shadow.mapSize.set(1024, 1024);   // static: re-rendered only when something near it changes lampLight.shadow.bias = -0.002; lampLight.shadow.radius = 6; scene.add(lampLight);
  spill(TREE.x + 0.4, 1.8, TREE.z + 1.3, 1.6, 3.4, 0xffb070);

  // ---------------------------------------------------------------- puppet
  const puppet = feltPuppet(marine, { felt, fuzz, metal, thread });
  scene.add(puppet.root);

  // ---------------------------------------------------------------- interactions (same as paper)
  const state = { door: 0, doorT: 0, lamp: 1, lampT: 1, tree: 1 };
  const hitLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, LAMP.h + 0.3, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitLamp.position.set(LAMP.x, (LAMP.h + 0.3) / 2, LAMP.z); scene.add(hitLamp);
  const hitTree = new THREE.Mesh(new THREE.ConeGeometry(1.3, TREE.h + 0.4, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hitTree.position.set(TREE.x, (TREE.h + 0.4) / 2 + 0.2, TREE.z); scene.add(hitTree);
  const clickables = [
    { name: 'door', objects: doorMeshes, act: () => { state.doorT = state.doorT ? 0 : 1; return state.doorT ? 'The shop door swings open' : 'The shop door closes'; } },
    { name: 'lamp', objects: [hitLamp], act: () => { state.lampT = state.lampT ? 0 : 1; return state.lampT ? 'The lamplighter lights the lamp' : 'The lamp goes out'; } },
    { name: 'tree', objects: [hitTree], act: () => { state.tree = state.tree ? 0 : 1; beadGlow.userData.twinkle.value = state.tree; return state.tree ? 'The tree lights twinkle' : 'The tree lights hold steady'; } },
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
    snowMat.uniforms.uPx.value = innerHeight * Math.min(devicePixelRatio, 1.5) / (2 * Math.tan(THREE.MathUtils.degToRad(40) / 2));
  }
  const setShells = (n) => { if (n > 0) fuzzU.shells.value = n; };
  return { name: 'felt', setShells, scene, update, clickables, puppet, meshes, exposure: 1.1, bokeh: 0.0005, aoRadius: 0.4 };
}
