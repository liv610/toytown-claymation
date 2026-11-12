// The textile corner of Toy Town: the blue toy shop, the pink house, the town tree, both lamps, the bench, the wagon,
// garlands, presents under the tree, the firs and the first row of neighbours, and the stretch of street in front —
// everything the clay corner contained (corner.json, written by export_region.py --split-corner), rebuilt in the
// textile construction language at the same positions. It plugs into the journey's host (diorama.js) through
// a small contract: a group to add, meshes for camera collision and ground probes, the shop door for the door hinge.
import * as THREE from 'three';
import { Batch, M, V, rect, roundRect } from './vendor/kit.js';
import { makeKit, TF } from './vendor/textile_kit.js';
import { presents, garlands } from './vendor/textile_props.js';
import { DOOR, SHOP } from './vendor/layout.js';
import { extendKit } from './construct.js';
import { shop, pinkHouse, holly, C } from './buildings.js';
import { house } from './houses.js';
import { christmasTree, lamp, bench, wagon, street } from './props.js';
import { materials, kitMeshes, timeU, clothe, guard } from './materials.js';
import { dressPuppet } from './puppet.js';
import { teddy } from './buildings.js';

export { clothe };
/** dress one of the journey's Marine clones as the stuffed puppet (its clips, IK and story are untouched) */
export function puppet(obj, colors) {
  const m = materials();
  return dressPuppet(obj, { ...m, felt: m.puppetFelt || (m.puppetFelt = feltFor(2.2)), woven: m.puppetCotton || (m.puppetCotton = wovenFor(4.5)) }, colors);
}
import { textileMaterial } from './vendor/textile_materials.js';
const feltFor = (s) => guard(textileMaterial('felt', { scaleMul: s, name: 'puppetFelt' })), wovenFor = (s) => guard(textileMaterial('woven', { scaleMul: s, name: 'puppetCotton' }));

/** the new toy in the story, textile version: a stuffed felt bear (unwrapped), origin at its centre like gift.glb */
export function storyToy() {
  const k = extendKit(makeKit(77)), g = new THREE.Group();
  teddy(k, M([0, -0.12, 0], [0, 0, 0], 0.85), 1.0);
  for (const m of kitMeshes(k)) g.add(m);
  return g;
}

/** the toy drop-off box, textile version: a painted wooden crate with a cream rim and a sewn card sign (sign: the
 *  journey's own lettered canvas), the same size and anchor as the clay box */
export function dropOffBox(signCanvas) {
  const k = extendKit(makeKit(55)), W = 0.62, D = 0.44, Hh = 0.42, t = 0.035;
  for (const [x, z, w, d] of [[0, D / 2 - t / 2, W, t], [0, -D / 2 + t / 2, W, t], [W / 2 - t / 2, 0, t, D], [-W / 2 + t / 2, 0, t, D]]) k.solid(new THREE.BoxGeometry(w, Hh, d), M([x, Hh / 2, z]), 0xb8322a, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(W, t, D), M([0, t / 2, 0]), 0xb8322a, { batch: 'paint', smooth: false });
  k.solid(new THREE.BoxGeometry(W + 0.05, 0.04, D + 0.05), M([0, Hh, 0]), C.cream, { batch: 'paint', smooth: false });
  k.drape(M([0, 0.14, 0], [-Math.PI / 2, 0, 0]), -W / 2 + 0.04, W / 2 - 0.04, -D / 2 + 0.04, D / 2 - 0.04, { thick: 0.05, edge: 0.06, rag: 0.04, res: 0.06, color: 0x6f8f7c });
  k.solid(new THREE.CylinderGeometry(0.018, 0.018, 0.66), M([0, 0.38, -D / 2 - 0.03]), 0x7a4b2a, { batch: 'paint', smooth: false });
  // the sign: a felt backing a little larger than the card, blanket-stitched round its edge
  const back = roundRect(-0.31, -0.16, 0.31, 0.16, 0.03), SB = M([0, 0.74, -D / 2 - 0.03], [0, Math.PI, 0]);
  k.panel(back, null, SB.clone().multiply(M([0, 0, -0.02])), 0x2f6b55, { t: 0.02, stuff: 0, amp: 0.003 });
  k.S.blanket(SB, back, 0.0, C.cream, { step: 0.05, depth: 0.03, r: 0.006 });
  k.lump(0.3, 0.035, 0.05, M([0, 0.91, -D / 2 - 0.03]), 0xf7f4ee, { batch: 'batt', detail: 1, amp: 0.3 });
  const g = new THREE.Group(); for (const m of kitMeshes(k)) g.add(m);
  const tex = new THREE.CanvasTexture(signCanvas); tex.colorSpace = THREE.SRGBColorSpace;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.27), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  card.position.set(0, 0.74, -D / 2 - 0.035); card.rotation.y = Math.PI; g.add(card);
  return g;
}

// Toy Town's street edges (scripts/tt/street.py e_near / e_far, in three.js z = -y; the small noise term is left out
// and covered by the batting drifts along both edges)
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const streetNear = (x) => 0.62 + 1.35 * (1 - smooth01(-3.6, -2.9, x)) + 1.25 * smooth01(8.3, 9.0, x);
export const streetFar = (x) => 6.1 - 0.65 * Math.sin(0.17 * x + 0.4);
const yup = ([x, y, z]) => [x, z, -y];

export function buildCorner(spec) {
  const t0 = performance.now();
  const k = extendKit(makeKit(21)), kb = extendKit(makeKit(31));        // kb: the row behind (no shadows, cheaper)
  const sk = { lights: new Batch('treeLights', 3), lamp: new Batch('lampGlow', 4) };
  const R = spec.roots, P = (n) => R[n].pos;
  // a small ledger: time and triangles each part of the corner adds (for the performance report)
  const ledger = [], kits = [k, kb, sk.lights, sk.lamp];
  const triCount = () => kits.reduce((s, b) => s + Object.values(b.B || { b }).reduce((t, x) => t + x.parts.reduce((u, g) => u + g.attributes.position.count / 3, 0), 0) + (b.S ? b.S.items.length * 8 : 0), 0);
  const part = (name, fn) => { const a = performance.now(), t0 = triCount(); const r = fn(); ledger.push({ name, ms: Math.round(performance.now() - a), triangles: Math.round(triCount() - t0) }); return r; };

  part('toy shop', () => shop(k)); part('pink house', () => pinkHouse(k));
  part('Christmas tree', () => christmasTree(k, sk, P('XmasTree')[0], P('XmasTree')[2], 3.3));
  const lamps = part('lamps', () => ({ LampWest: lamp(k, sk, P('LampWest')[0], P('LampWest')[2], 3.3), LampEast: lamp(k, sk, P('LampEast')[0], P('LampEast')[2], 3.2) }));
  part('bench', () => bench(k, P('Bench')[0], 0.0, P('Bench')[2], R.Bench.rot_z));
  const wg = part('wagon', () => wagon(k, P('Wagon')[0], P('Wagon')[2], R.Wagon.rot_z));
  part('presents + garlands', () => { presents(k); garlands(k, sk); });
  for (const [name, f] of Object.entries(spec.fir)) if (name !== 'XmasTree') part('fir ' + name, () => {   // (the clay town tree is listed as a fir too: the decorated tree replaces it)
    const [x, y, z] = yup(f.pos), dark = name !== 'FirGap';
    k.feltFir(x, y, z, f.h, { R: f.r * 0.95, tiers: f.h > 5 ? 10 : 8, col: dark ? 0x1f4c33 : 0x2a5e3c, col2: dark ? 0x24543a : 0x2f6a42, light: 0x3c7a4c, seed: name.length * 7, snow: 0.7 });
  });
  let i = 0;
  for (const [name, h] of Object.entries(spec.bg_house)) {
    const near = name === 'Bg0' || name === 'Bg4';
    part('house ' + name, () => house(near ? k : kb, h, { detail: near ? 1 : 0, seed: 3 + i++ }));
  }
  part('street', () => street(k, { x0: spec.rect[0], x1: spec.rect[1], near: streetNear, far: streetFar }));

  // ---------------- the shop door: green felt, appliqué panels, a curtained light, a wooden knob, holly
  const dk = extendKit(makeKit(23)), w = DOOR.w - 0.02, h = DOOR.h - 0.02;
  dk.panel(roundRect(0, 0, w, h, 0.03), [roundRect(0.16, 1.42, w - 0.16, 1.98, 0.05)], M([0, 0, -TF / 2]), 0x3f6f57, { t: TF, stuff: 0, amp: 0.004 });
  for (const [px, py] of [[0.12, 0.18], [w - 0.48, 0.18], [0.12, 0.78], [w - 0.48, 0.78]]) {
    const o = roundRect(px, py, px + 0.36, py + 0.5, 0.04);
    dk.cut(o, null, M([0, 0, TF / 2]), 0x2f5a45, { t: 0.03, bevel: 0.01, amp: 0.004 });
    dk.S.running(M([0, 0, TF / 2 + 0.032]), roundRect(px + 0.045, py + 0.045, px + 0.315, py + 0.455, 0.03), 0, 0x9ccab0, { closed: true, len: 0.04, gap: 0.028, r: 0.007 });
  }
  { const pos = [], idx = [], nx = 18; for (let j = 0; j <= 2; j++) for (let q = 0; q <= nx; q++) { const u = q / nx; pos.push(0.12 + u * (w - 0.24), 1.38 + j * 0.32, -0.01 - 0.02 * Math.abs(Math.sin(u * 7 * Math.PI))); }
    for (let j = 0; j < 2; j++) for (let q = 0; q < nx; q++) { const a = j * (nx + 1) + q; idx.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); dk.B.glow.add(g, null, 0xffc985, {}); }
  dk.cut(rect(0.16, 1.68, w - 0.16, 1.72), null, M([0, 0, TF / 2]), C.card, { batch: 'card', t: 0.02, amp: 0 });
  dk.cut(rect(w / 2 - 0.02, 1.42, w / 2 + 0.02, 1.98), null, M([0, 0, TF / 2]), C.card, { batch: 'card', t: 0.02, amp: 0 });
  dk.solid(new THREE.SphereGeometry(0.045, 10, 8), M([w - 0.14, 1.05, TF / 2 + 0.04]), C.gold, { batch: 'paint' });
  dk.S.blanket(M([0, 0, 0]), roundRect(0, 0, w, h, 0.03), TF / 2, C.thread, { step: 0.08, depth: 0.045 });
  holly(dk, M([w / 2, 2.1, TF / 2 + 0.02]), 4, 0.8);
  const door = new THREE.Group(); door.name = 'textileDoor';
  for (const m of kitMeshes(dk)) door.add(m);
  const doorPivot = V(SHOP.x + DOOR.x - DOOR.w / 2 + 0.01, DOOR.y0 + 0.01, SHOP.z + TF / 2);

  // ---------------- meshes
  const group = new THREE.Group(); group.name = 'textileCorner';
  const front = kitMeshes(k, { extra: { lights: sk.lights, lamp: sk.lamp } }), back = kitMeshes(kb, { cast: false });
  for (const m of back) m.userData.helperSkip = true;
  for (const m of [...front, ...back]) group.add(m);
  const collide = [...front, ...back].filter((m) => m.isMesh && !m.isInstancedMesh && !/glow|lights|lamp/i.test(m.material.name || ''));
  const buildMs = performance.now() - t0;
  let tris = 0; group.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); });
  return {
    group, collide, door, doorPivot, lamps, wagonTop: wg.top, buildMs, triangles: Math.round(tris), ledger,
    lampMaterial: materials().lamp, update(t) { timeU.value = t; },
  };
}

/**
 * The region's other houses (houses.json, written by export_region.py --split-houses: the hillside behind the street,
 * the square, cottages and farmhouses), each sewn in felt at the footprint, height, pitch and colour the clay village
 * used. Background detail: bigger roof tabs, coarser stuffing, no shutters or stitching (house() detail 0).
 */
export function buildFeltHouses(specs) {
  const t0 = performance.now(), k = extendKit(makeKit(77)), group = new THREE.Group();
  group.name = 'felt houses';
  let i = 0;
  for (const h of Object.values(specs)) house(k, h, { detail: 0, seed: 11 + i++, style: 'felt' });
  const meshes = kitMeshes(k);
  for (const m of meshes) group.add(m);
  const collide = meshes.filter((m) => !m.isInstancedMesh && m.material && !/glow/i.test(m.material.name || ''));
  let triangles = 0; for (const m of meshes) if (m.geometry && m.geometry.index) triangles += m.geometry.index.count / 3 * (m.isInstancedMesh ? m.count : 1);
  return { group, collide, count: i, triangles: Math.round(triangles), buildMs: performance.now() - t0 };
}
