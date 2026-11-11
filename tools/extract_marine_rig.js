// Extract the Marine's skeleton and animation clips (no mesh) into a small JS data module for the handmade styles.
//   cd web && NODE_PATH=$PWD/node_modules node ../tools/extract_marine_rig.js [realtime/assets/marine.glb] [handmade/src/marine_rig.js]
// Why: artifacts can't serve .glb, and shipping the model as base64 text is refused by the public-sharing review.
const { NodeIO } = require('@gltf-transform/core'); const { ALL_EXTENSIONS } = require('@gltf-transform/extensions'); const { MeshoptDecoder } = require('meshoptimizer'); const fs = require('fs');
const [src = 'realtime/assets/marine.glb', dst = 'handmade/src/marine_rig.js'] = process.argv.slice(2);
(async () => {
  await MeshoptDecoder.ready;
  const r = (await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder }).read(src)).getRoot();
  const nodes = r.listNodes().filter((n) => !n.getMesh()), idx = new Map(nodes.map((n, i) => [n, i])), parent = new Map();
  for (const n of r.listNodes()) for (const c of n.listChildren()) parent.set(c, n);
  const f = (a) => a.map((v) => +v.toFixed(5));
  const out = { nodes: nodes.map((n) => ({ name: n.getName(), parent: parent.has(n) && idx.has(parent.get(n)) ? idx.get(parent.get(n)) : -1, t: f(n.getTranslation()), r: f(n.getRotation()), s: f(n.getScale()) })) };
  out.joints = r.listSkins()[0].listJoints().map((j) => idx.get(j));
  const mesh = r.listNodes().find((n) => n.getMesh()); out.meshParent = parent.has(mesh) ? idx.get(parent.get(mesh)) : -1;
  out.anims = r.listAnimations().map((a) => ({ name: a.getName(), ch: a.listChannels().map((c) => { const s = c.getSampler(); return { node: idx.get(c.getTargetNode()), path: c.getTargetPath(), interp: s.getInterpolation(), t: Array.from(s.getInput().getArray()).map((v) => +v.toFixed(4)), v: f(Array.from(s.getOutput().getArray())) }; }) }));
  fs.writeFileSync(dst, `// The Marine's skeleton and clips, extracted from ${src} by tools/extract_marine_rig.js (no mesh: the handmade\n// styles build their own puppets on this rig). Regenerate with that script if the Marine's rig changes.\nexport default ${JSON.stringify(out)};\n`);
  console.log('wrote', dst, out.nodes.length, 'nodes,', out.anims.map((a) => a.name).join(', '));
})();
