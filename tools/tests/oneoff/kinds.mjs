import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const k = {};
  for (const m of doc.getRoot().listMaterials()) { const x = (m.getExtras() || {}).kind || '(none)'; (k[x] = k[x] || []).push(m.getName() + (m.getMetallicFactor() > 0 ? ' metal' + m.getMetallicFactor() : '') + ' r' + m.getRoughnessFactor().toFixed(2)); }
  console.log(f); for (const [x, l] of Object.entries(k)) console.log(' ', x, l.length, l.slice(0, 14).join(', '));
}
