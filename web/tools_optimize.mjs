// Make the exported scene browser-sized: drop baked normals (three.js recomputes),
// weld, simplify per mesh with an error bound, quantize + meshopt-compress.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

const [,, inp, out, ratioArg, errArg] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const doc = await io.read(inp);
let before = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
  before += p.getIndices().getCount() / 3;
  const n = p.getAttribute('NORMAL'); if (n) { p.setAttribute('NORMAL', null); }
}
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: +ratioArg, error: +errArg, lockBorder: false }),
  dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
let after = 0; const per = [];
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) {
  const c = p.getIndices().getCount() / 3; after += c; per.push([c, m.getName()]);
}
await io.write(out, doc);
per.sort((a, b) => b[0] - a[0]);
console.log(`triangles ${before} -> ${after}`); console.log(per.slice(0, 8).map(x => x.join(' ')).join('\n'));
