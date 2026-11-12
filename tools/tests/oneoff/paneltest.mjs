import * as THREE from 'three';
import { panelGeo } from '/home/user/toytown-claymation/web/textile/src/construct.js';
const out = [[-0.45,0],[0.45,0],[0.45,3],[-0.45,3]], hole = [[-0.35,0.2],[0.35,0.2],[0.35,1.7],[-0.35,1.7]];
for (const opt of [{ stuff: 0.035 }, { stuff: 0.035, pucker: 0.006, seamLines: [[-0.43, 0, -0.43, 3]] }]) {
  const g = panelGeo(out, [hole], { t: 0.07, ...opt }); const p = g.attributes.position; let bad = 0, front = 0, maxdz = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    if (Math.min(a.z, b.z, c.z) < 0.06) continue; front++; const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize(); if (Math.abs(n.z) < 0.8) { bad++; maxdz = Math.max(maxdz, Math.max(a.z,b.z,c.z) - Math.min(a.z,b.z,c.z)); } }
  console.log(JSON.stringify(opt).slice(0,40), 'front tris', front, 'steep', bad, 'max dz', maxdz.toFixed(3));
}
