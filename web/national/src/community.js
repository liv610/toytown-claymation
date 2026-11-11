// Maple Hollow, Ohio (fictional): the first story community. Built in Blender with Toy Town's own generators
// (scripts/tt/community.py → scripts/export_community.py → maple.glb), so it shares Toy Town's look:
// softened clay walls, sculpted snow slabs, icicles, holly window boxes, wreaths, raised lettering, domed cobbles,
// needle-tier firs, lampposts and gift piles. Placed on the national relief at miniature scale (group scale S).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clay as claySurface } from './clay.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const S = 0.2;                   // Toy Town units → map units
const CLAY_KINDS = { clay: 'clay', snow: 'snow', wood: 'wood', cobble: 'cobble', fabric: 'fabric', felt: 'clay' };

export async function loadGLB(url, b64) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (b64) { const txt = await (await fetch(b64)).text(); return loader.parseAsync(Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0)).buffer, ''); }
  return loader.loadAsync(url);
}

export async function createCommunity(scene, siteWorld, { assets = './assets/', b64 = null, tier = 'high' } = {}) {
  const root = new THREE.Group(); root.position.copy(siteWorld); root.scale.setScalar(S); scene.add(root);
  root.visible = false;
  const [gltf, meta] = await Promise.all([loadGLB(assets + 'maple.glb', b64 && b64['maple.glb']), fetch(assets + 'maple.json').then((r) => r.json())]);

  // materials by kind: clay family gets the national clay surface; glows and bulbs are driven by dusk
  const glows = [], bulbs = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeVertexNormals();
    const m = o.material, ex = m.userData || {}, kind = ex.kind || 'clay';
    o.castShadow = !['glow', 'emissive', 'ice'].includes(kind); o.receiveShadow = true;
    if (kind === 'ice') { m.transparent = true; m.opacity = 0.75; m.roughness = 0.1; }
    else if (kind === 'glow') { m.userData.base = Math.max(1, m.emissiveIntensity); glows.push(m); }
    else if (kind === 'emissive') { m.userData.base = Math.max(1, m.emissiveIntensity); bulbs.push(m); }
    else if (CLAY_KINDS[kind]) { claySurface(m, CLAY_KINDS[kind], false); if (kind === 'snow') m.roughness = 0.8; }
  });
  root.add(gltf.scene);

  // street lamps: light in world units (distance × S, intensity × S²)
  const lamps = meta.lamps.map(([x, y, z]) => { const L = new THREE.PointLight(0xffb468, 0, 9 * S, 2); L.position.set(x, y, z); root.add(L); return L; });
  const treeGlow = new THREE.PointLight(0xffc070, 0, 8 * S, 2); treeGlow.position.set(meta.tree[0], 3.5, meta.tree[2]); root.add(treeGlow);

  // falling snow (only drawn when the camera is down in the town)
  const NF = tier === 'low' ? 500 : 1400, sp = new Float32Array(NF * 4);
  for (let i = 0; i < NF; i++) sp.set([(Math.random() - 0.5) * 60, Math.random() * 16, (Math.random() - 0.5) * 50, Math.random()], i * 4);
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3)); sgeo.setAttribute('seed', new THREE.BufferAttribute(sp, 4));
  const snowU = { uT: { value: 0 }, uA: { value: 0 }, uPx: { value: 800 } };
  const flakes = new THREE.Points(sgeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: snowU,
    vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vA; void main(){ vec3 p = seed.xyz; p.y = mod(p.y - (0.6 + seed.w) * 0.9 * uT, 16.0);
      p.x += 0.35 * sin(uT * (0.5 + seed.w) + seed.w * 30.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((0.03 + 0.04 * seed.w) * ${S.toFixed(3)} * uPx / -mv.z, 0.8, 30.0); vA = 1.0; }`,
    fragmentShader: 'uniform float uA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(1.0, 0.97, 0.92, smoothstep(1.0, 0.55, d) * 0.85 * uA); }' }));
  flakes.frustumCulled = false; root.add(flakes);

  const local = (v) => siteWorld.clone().add(V(...v).multiplyScalar(S));
  // ground height (town units) under a point of the street or sidewalk, for the characters' feet
  const groundMeshes = []; gltf.scene.traverse((o) => { if (o.isMesh && /^(Snow|Cobble|Curb|Footing)/.test(o.name)) groundMeshes.push(o); });
  const rc = new THREE.Raycaster(), gcache = new Map();
  function groundAt(x, z) {
    const k = Math.round(x * 6) + ',' + Math.round(z * 6);
    if (gcache.has(k)) return gcache.get(k);
    root.updateMatrixWorld(true);
    rc.set(root.localToWorld(V(Math.round(x * 6) / 6, 1.6, Math.round(z * 6) / 6)), V(0, -1, 0)); rc.far = 2.2 * S;
    const h = rc.intersectObjects(groundMeshes, false)[0], y = h ? root.worldToLocal(h.point.clone()).y : 0;
    gcache.set(k, y); return y;
  }
  return {
    root, meta, groundAt,
    boxWorld: local(meta.box), treeWorld: local(meta.tree),
    // dusk: 0 = daylight seen from the sky, 1 = blue-hour street with lamps and windows lit
    setDusk(d, t, pxScale) {
      glows.forEach((m) => { m.emissiveIntensity = m.userData.base * (0.25 + 0.75 * d); });
      bulbs.forEach((m, i) => { m.emissiveIntensity = m.userData.base * (0.3 + 0.7 * d) * (0.8 + 0.2 * Math.sin(t * 2.3 + i)); });
      lamps.forEach((L) => { L.intensity = 26 * S * S * d; });
      treeGlow.intensity = 14 * S * S * d;
      snowU.uT.value = t; snowU.uA.value = d; snowU.uPx.value = pxScale; flakes.visible = d > 0.02;
    },
    // standing in the street, looking at the hall, the drop-off box and the town tree
    streetPose() {
      const portrait = innerWidth < innerHeight;
      // approach along the street from the east (no buildings in the way), end looking at the hall past the town tree
      return { target: local([-1.2, 2.1, 0.5]), dist: (portrait ? 12.5 : 11.5) * S, el: THREE.MathUtils.degToRad(portrait ? 9 : 7), az: THREE.MathUtils.degToRad(portrait ? 58 : 62) };
    },
  };
}
