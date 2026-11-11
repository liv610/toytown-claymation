// The felt look for the same corner (the owner preferred the felt test, without its fibres: "everything feels soft,
// almost like a toy"). Same contract as corner.js, so the journey swaps it in the same way.
//
//   * the shop, pink house, Christmas tree, lamps, presents and shop door come from the felt test
//     (vendor/felt_*.js, unchanged), drawn with its felt material but WITHOUT the fibre shells;
//   * the rest of the corner (neighbours, firs, street, bench, wagon) is built with our construction kit in felt
//     settings: thicker felt, cream felt frames outlined in running stitch, stuffed felt pebbles, felt cone firs;
//   * the Marines stay the textile puppets (owner's choice).
import * as THREE from 'three';
import { Batch, M, V, rect, ellipse, rng, GLSL_NOISE } from './vendor/kit.js';
import { makeFeltKit, firGeo } from './vendor/felt_kit.js';
import { shop, pinkHouse } from './vendor/felt_build.js';
import { tree, lamp, presents, backdrop, door as feltDoor } from './vendor/felt_props.js';
import { feltMaterial, threadMaterial, fabricMaterial, timeU as feltTime } from './vendor/felt_materials.js';
import { TREE, LAMP, DOOR, SHOP } from './vendor/layout.js';
import { FT } from './vendor/felt_kit.js';
import { makeKit } from './vendor/textile_kit.js';
import { extendKit } from './construct.js';
import { house } from './houses.js';
import { bench, wagon, street } from './props.js';
import { kitMeshes, guard, timeU } from './materials.js';
import { streetNear, streetFar } from './corner.js';

const yup = ([x, y, z]) => [x, z, -y];

export function buildFeltCorner(spec) {
  const t0 = performance.now(), ledger = [];
  const fk = makeFeltKit(11), tk = extendKit(makeKit(41)), tkb = extendKit(makeKit(43));
  const sk = { lights: new Batch('treeLights', 3), lamp: new Batch('lampGlow', 4), ribbon: new Batch('ribbon', 6), gifts: [] };
  const R = spec.roots, P = (n) => R[n].pos;
  const part = (name, fn) => { const a = performance.now(); const r = fn(); ledger.push({ name, ms: Math.round(performance.now() - a) }); return r; };

  part('toy shop + pink house (felt test)', () => { shop(fk); pinkHouse(fk); });
  // the felt test's tree and lamp read their positions from the shared layout object: point it at Toy Town's own
  const saved = { tree: { ...TREE }, lamp: { ...LAMP } };
  part('Christmas tree', () => { Object.assign(TREE, { x: P('XmasTree')[0], z: P('XmasTree')[2] }); tree(fk, sk); });
  const lamps = part('lamps', () => {
    const out = {};
    for (const [n, h] of [['LampWest', 3.3], ['LampEast', 3.2]]) { Object.assign(LAMP, { x: P(n)[0], z: P(n)[2], h }); out[n] = lamp(fk, sk); }
    return out;
  });
  Object.assign(TREE, saved.tree); Object.assign(LAMP, saved.lamp);
  part('presents', () => presents(fk, sk));
  part('bench + wagon', () => { bench(tk, P('Bench')[0], 0.0, P('Bench')[2], R.Bench.rot_z); wagon(tk, P('Wagon')[0], P('Wagon')[2], R.Wagon.rot_z); });
  part('firs', () => {
    for (const [name, f] of Object.entries(spec.fir)) {
      if (name === 'XmasTree') continue;
      const [x, y, z] = yup(f.pos);
      fk.B.flat.add(firGeo(f.h, f.r * 0.9, { tiers: f.h > 5 ? 7 : 5, seed: name.length }), M([x, y, z]), name === 'FirGap' ? 0x2f6a42 : 0x24543a, { vary: 0.05 });
      fk.lump(f.r * 0.5, 0.08, f.r * 0.5, M([x, y + 0.05, z]), 0xf7f4ee, { batch: 'wool', detail: 2, amp: 0.3 });
    }
  });
  let i = 0;
  for (const [name, h] of Object.entries(spec.bg_house)) {
    const near = name === 'Bg0' || name === 'Bg4';
    part('house ' + name, () => house(near ? tk : tkb, h, { detail: near ? 1 : 0, seed: 3 + i++, style: 'felt' }));
  }
  part('street', () => street(tk, { x0: spec.rect[0], x1: spec.rect[1], near: streetNear, far: streetFar, pillow: true, kerb: 0x8a8090 }));

  // ---------------- materials: the felt test's felt, no fibre shells; our textile set for the kit-built parts
  const felt = guard(feltMaterial()), wool = guard(feltMaterial({ name: 'wool', scale: 3.2, bump: 0.01, sheen: 1.0 })), glow = guard(feltMaterial({ name: 'glowFelt', glow: 1.25 }));
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.32 }), bead = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const thread = threadMaterial(), beadGlow = guard(feltMaterial({ name: 'treeLights', glow: 3.0 })), lampMat = guard(feltMaterial({ name: 'lampPanes', glow: 2.4, side: THREE.DoubleSide }));
  const satin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, sheen: 1, sheenRoughness: 0.25, sheenColor: new THREE.Color(1, 0.9, 0.85) });
  const group = new THREE.Group(); group.name = 'feltCorner';
  const add = (m, cast = true) => { if (!m) return null; m.castShadow = cast; m.receiveShadow = true; group.add(m); return m; };
  add(fk.B.felt.mesh(felt)); add(fk.B.flat.mesh(felt)); add(fk.B.wool.mesh(wool)); add(fk.B.glow.mesh(glow), false);
  add(fk.B.metal.mesh(metal)); add(fk.B.bead.mesh(bead)); add(fk.S.build(thread));
  for (const g of sk.gifts) { const m = new THREE.Mesh(g.geo, guard(fabricMaterial(g.c1, g.c2, { pattern: g.pattern, check: g.pattern === 'gingham' ? 0.075 : 0.12 }))); m.applyMatrix4(g.matrix); add(m); }
  add(sk.ribbon.mesh(satin)); add(sk.lights.mesh(beadGlow), false); add(sk.lamp.mesh(lampMat), false);
  for (const m of kitMeshes(tk)) group.add(m);
  for (const m of kitMeshes(tkb, { cast: false })) { m.userData.helperSkip = true; group.add(m); }

  // ---------------- the shop door (the felt test's), on the same hinge
  const dk = makeFeltKit(23); feltDoor(dk);
  const doorG = new THREE.Group(); doorG.name = 'feltDoor';
  for (const m of [dk.B.felt.mesh(felt), dk.B.flat.mesh(felt), dk.B.glow.mesh(glow), dk.B.metal.mesh(metal), dk.B.bead.mesh(bead), dk.S.items.length ? dk.S.build(thread) : null]) if (m) doorG.add(m);
  const doorPivot = V(SHOP.x + DOOR.x - DOOR.w / 2 + 0.01, DOOR.y0 + 0.01, SHOP.z + FT / 2);

  const collide = []; group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && ![glow, beadGlow, lampMat].includes(o.material) && !/glow|lights|lamp/i.test(o.material.name || '')) collide.push(o); });
  let tris = 0; group.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); });
  const stage = part('stage (felt world around the corner)', () => feltStage(spec, { felt, wool, glow, thread }));
  for (const m of stage.ground) collide.push(m);
  group.add(stage.group);
  return { group, collide, door: doorG, doorPivot, lamps, stage, buildMs: performance.now() - t0, triangles: Math.round(tris), ledger,
    update(t) { feltTime.value = t; timeU.value = t; stage.update(t); } };
}

/**
 * The felt world around the corner, so the whole frame is handmade (what made the felt style test feel magical):
 *   a stitched base of stacked felt (the diorama on its table), stuffed felt mounds under the raised houses at the back,
 *   the style test's backdrop (a gathered cloth sky with gold-stitched stars and a stuffed moon, three layers of felt
 *   hills with wool snow caps, felt houses with glowing windows, rows of felt firs), wool-puff snow, and its light:
 *   a warm key, a cool rim from behind, a darker night. While it shows, the host hides the clay village.
 */
function feltStage(spec, { felt, wool, glow, thread }) {
  const k = makeFeltKit(91), sk = {}, r = rng(5);
  const X0 = -15, X1 = 17.5, Z0 = -13, Z1 = 10;
  // the base: three layers of thick felt, the top one snow-white, blanket-stitched round the top edge
  for (let i = 0; i < 3; i++) {
    const th = 0.1, y = -0.3 + i * th, ins = i * 0.04;
    k.cut(rect(X0 + ins, -Z1 + ins, X1 - ins, -Z0 - ins), null, M([0, y, 0], [-Math.PI / 2, 0, 0]), [0x6a5a4e, 0x8a7666, 0xece6dc][i], { t: th, bevel: 0.035, amp: 0.03, wave: 0.9, fuzz: 0 });
  }
  // the road: a strip of grey felt between Toy Town's own curbs, under the stuffed pebbles
  { const xs = []; for (let x = spec.rect[0]; x <= spec.rect[1] + 1e-6; x += 0.25) xs.push(x);
    const road = [...xs.map((x) => [x, -streetNear(x)]), ...xs.slice().reverse().map((x) => [x, -streetFar(x)])];
    k.cut(road, null, M([0, -0.03, 0], [-Math.PI / 2, 0, 0]), 0x7d7686, { t: 0.03, bevel: 0.01, amp: 0.02, wave: 0.8, fuzz: 0 }); }
  k.S.blanket(M([0, 0.002, 0], [-Math.PI / 2, 0, 0]), rect(X0 + 0.14, -Z1 + 0.14, X1 - 0.14, -Z0 - 0.14), 0.0, 0x8a7666, { step: 0.14, depth: 0.09, r: 0.012, over: 0.05 });
  // stuffed mounds where the clay land rose behind the street (the back row of houses and firs stood higher)
  const mounds = [];
  for (const [name, h] of Object.entries(spec.bg_house)) if (h.pos[2] > 0.15) mounds.push([h.pos[0], -h.pos[1] + h.D * -0.45, Math.max(h.W, h.D) * 0.85 + 0.9, h.pos[2] + 0.04]);
  for (const [name, f] of Object.entries(spec.fir)) if (f.pos[2] > 0.15) mounds.push([f.pos[0], -f.pos[1], f.r * 1.4 + 0.5, f.pos[2] + 0.04]);
  for (const [x, z, rad, h] of mounds) {
    k.pillow(ellipse(0, 0, rad, rad * 0.8, 40), h, M([x, 0.0, z], [-Math.PI / 2, 0, r() * 0.4]), 0xe9e3d8, { batch: 'flat', rings: 5, flat: 5, under: 0.0, amp: 0.05, fuzz: 0 });
  }
  // the style test's backdrop (its own coordinates match Toy Town's: hills from z = -10 to -24, sky radius 40)
  backdrop(k, sk);
  const g = new THREE.Group(); g.name = 'feltStage';
  const add = (m, cast = false) => { if (!m) return null; m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
  const ground = [add(k.B.felt.mesh(felt)), add(k.B.flat.mesh(felt))].filter(Boolean);
  add(k.B.wool.mesh(wool)); add(k.B.glow.mesh(glow)); add(k.B.metal && k.B.metal.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.35 })));
  if (k.S.items.length) add(k.S.build(thread));
  // the sky: dark blue cotton, gently gathered
  const sky = new THREE.Mesh(sk.sky.geo, new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: GLSL_NOISE + `varying vec2 vUv; varying vec3 vP;
      void main(){ float y = vUv.y; vec3 top = vec3(0.02, 0.025, 0.07), mid = vec3(0.05, 0.055, 0.13), low = vec3(0.15, 0.10, 0.16);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.35, y)); c = mix(c, top, smoothstep(0.35, 1.0, y));
        float fold = 0.5 + 0.5 * sin(atan(vP.x, vP.z) * 70.0 + 2.0 * fbm3(vP * 0.2)); c *= 0.86 + 0.2 * fold;
        vec2 w = fract(vec2(atan(vP.x, vP.z) * 1400.0, vP.y * 220.0)); c *= 0.94 + 0.08 * step(0.5, w.x) * step(0.5, w.y);
        c *= 0.92 + 0.12 * fbm3(vP * 0.6); gl_FragColor = vec4(c, 1.0); }` }));
  sky.applyMatrix4(sk.sky.matrix); sky.renderOrder = -1; g.add(sky);
  // falling snow: little puffs of wool
  const N = 1400, sg = new THREE.BufferGeometry(), seed = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) seed.set([X0 + r() * (X1 - X0), r() * 13, Z0 + r() * (Z1 - Z0), r()], i * 4);
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); sg.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const puff = (() => { const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const c2 = cv.getContext('2d'), rr = rng(4);
    for (let i = 0; i < 260; i++) { const a = rr() * Math.PI * 2, d = rr() * n * 0.28, x = n / 2 + Math.cos(a) * d, y = n / 2 + Math.sin(a) * d, b = a + (rr() - 0.5) * 3, L = 4 + rr() * 12;
      c2.strokeStyle = `rgba(255,255,255,${0.25 + rr() * 0.35})`; c2.lineWidth = 0.8 + rr(); c2.beginPath(); c2.moveTo(x, y); c2.quadraticCurveTo(x + Math.cos(b) * L, y + Math.sin(b) * L, x + Math.cos(a) * L, y + Math.sin(a) * L); c2.stroke(); }
    return new THREE.CanvasTexture(cv); })();
  const snowU = { uT: { value: 0 }, uPx: { value: 800 }, tPuff: { value: puff } };
  const snow = new THREE.Points(sg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: snowU,
    vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vA; varying float vR;
      void main(){ vec3 p = seed.xyz; float H = 13.0; p.y = mod(p.y - (0.4 + 0.25 * seed.w) * uT, H) - 0.4;
        p.x += 0.4 * sin(uT * (0.35 + seed.w) + seed.w * 40.0); p.z += 0.25 * cos(uT * (0.3 + 0.5 * seed.w) + seed.w * 17.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vR = seed.w * 6.28;
        gl_PointSize = clamp((0.07 + 0.06 * fract(seed.w * 13.0)) * uPx / -mv.z, 1.5, 60.0); vA = 0.9; }`,
    fragmentShader: `uniform sampler2D tPuff; varying float vA; varying float vR;
      void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); q = mat2(c, -s, s, c) * q; vec4 t = texture2D(tPuff, q + 0.5);
        gl_FragColor = vec4(vec3(0.96, 0.95, 0.92), t.a * vA); }` }));
  snow.frustumCulled = false; g.add(snow);
  // a cool rim light from behind the hills (the warm key, lamps and windows are the town's own)
  const rim = new THREE.DirectionalLight(0x9fb0ff, 0.9); rim.position.set(9, 10, -14); g.add(rim, rim.target);
  return {
    group: g, ground,
    // the style test's night: used by the host while this stage shows
    light: { hemi: [0x6670b0, 0x3a2a30, 0.7], key: [0xffd6a6, 2.3], exposure: 1.1, fog: 0x121124, fogDensity: 0.004, background: 0x0e1024 },
    // a storybook camera: low, close, three-quarter views among the buildings, the hills always behind; free look stays
    // near street level (no high overhead view) and a little stronger depth of field makes it read as a miniature
    poses: (() => { const B = (x, y, z) => new THREE.Vector3(x, z, -y); return {
      overview: { pos: B(-6.6, -13.6, 2.7), look: B(1.6, -2.6, 1.9), fov: 50 },
      street: { pos: B(0.6, -7.6, 1.35), look: B(3.6, -1.4, 1.45), fov: 54 },
      tree: { pos: B(0.4, -8.6, 1.9), look: B(-3.0, -1.4, 1.5), fov: 50 },
      lamp: { pos: B(-1.4, -8.2, 1.9), look: B(-5.0, -2.3, 2.1), fov: 50 },
    }; })(),
    explore: { maxDistance: 14, minPolar: 58, maxPolar: 86 },
    dofBoost: 1.8,
    update(t) { snowU.uT.value = t; snowU.uPx.value = innerHeight * Math.min(devicePixelRatio, 1.5) / (2 * Math.tan(THREE.MathUtils.degToRad(40) / 2)); },
  };
}
