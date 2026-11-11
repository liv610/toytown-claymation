// The felt look for the same corner (the owner preferred the felt test, without its fibres: "everything feels soft,
// almost like a toy"). Same contract as corner.js, so the journey swaps it in the same way.
//
//   * the shop, pink house, Christmas tree, lamps, presents and shop door come from the felt test
//     (vendor/felt_*.js, unchanged), drawn with its felt material but WITHOUT the fibre shells;
//   * the rest of the corner (neighbours, firs, street, bench, wagon) is built with our construction kit in felt
//     settings: thicker felt, cream felt frames outlined in running stitch, stuffed felt pebbles, felt cone firs;
//   * the Marines stay the textile puppets (owner's choice).
import * as THREE from 'three';
import { Batch, M, V } from './vendor/kit.js';
import { makeFeltKit, firGeo } from './vendor/felt_kit.js';
import { shop, pinkHouse } from './vendor/felt_build.js';
import { tree, lamp, presents, door as feltDoor } from './vendor/felt_props.js';
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
  return { group, collide, door: doorG, doorPivot, lamps, buildMs: performance.now() - t0, triangles: Math.round(tris), ledger, update(t) { feltTime.value = t; timeU.value = t; } };
}
