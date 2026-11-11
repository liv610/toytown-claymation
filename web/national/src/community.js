// Maple Hollow, Ohio (fictional): the first story community. Modelled in metres, placed on the national relief at
// miniature scale (group scale S). It only exists in detail here; at national height it is a speck in the snow.
// Built from clay pieces (window frames, shutters, sills, gable roofs, snow caps, chimneys, steps), the regional
// diorama's clay fir prototypes, and a toy drop-off box at the community hall (Chapter 1's collection point).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clay as claySurface } from './clay.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const S = 0.12;                  // metres → map units

const mats = new Map();
function clay(color, kind = 'clay', extra = {}) {
  const key = color + kind + JSON.stringify(extra);
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: kind === 'snow' ? 0.85 : 0.8, ...extra }); claySurface(m, kind, true, S);
  mats.set(key, m); return m;
}
const windowGlass = new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffb056, emissiveIntensity: 0.4, roughness: 0.35 });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

// one building, front facing +z, origin at the front-bottom centre
function building(o) {
  const g = new THREE.Group(), { w, h, d } = o, rh = o.roofH ?? w * 0.42;
  const wall = clay(o.wall), trim = clay(o.trim ?? 0xf3e7cf), roofM = clay(o.roof), snow = clay(0xf4f1ea, 'snow');
  add(g, new THREE.BoxGeometry(w, h, d), wall, 0, h / 2, -d / 2);
  add(g, new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), clay(0x8a7a6a), 0, 0.17, -d / 2);                       // stone footing
  for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.35, h, 0.35), trim, sx * (w / 2 - 0.12), h / 2, 0.06);   // corner boards
  add(g, new THREE.BoxGeometry(w + 0.2, 0.3, 0.3), trim, 0, h - 0.1, 0.08);                                        // eave board
  // gable roof with overhang, then a soft snow blanket that droops over the eaves
  const tri = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.7, 0), new THREE.Vector2(0, rh), new THREE.Vector2(w / 2 + 0.7, 0)]);
  add(g, new THREE.ExtrudeGeometry(tri, { depth: d + 1.2, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 }), roofM, 0, h, -d - 0.6);
  const sn = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.85, 0.15), new THREE.Vector2(0, rh + 0.35), new THREE.Vector2(w / 2 + 0.85, 0.15), new THREE.Vector2(w / 2 + 0.55, -0.05), new THREE.Vector2(0, rh - 0.05), new THREE.Vector2(-w / 2 - 0.55, -0.05)]);
  add(g, new THREE.ExtrudeGeometry(sn, { depth: d + 1.4, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 3 }), snow, 0, h, -d - 0.7);
  for (let i = 0; i < Math.floor(w * 1.4); i++) {                                                                  // drips along the front eave
    const x = -w / 2 - 0.5 + (i + 0.5) * (w + 1) / Math.floor(w * 1.4);
    add(g, new THREE.SphereGeometry(0.18 + 0.08 * Math.sin(i * 2.7), 8, 6), snow, x, h + 0.02, 0.62).scale.set(1, 1.4 + 0.5 * Math.abs(Math.sin(i * 1.7)), 1);
  }
  if (o.chimney !== false) { add(g, new THREE.BoxGeometry(0.9, 2.4, 0.9), clay(0x9a4a3a), w * 0.24, h + rh * 0.55, -d * 0.62); add(g, new THREE.BoxGeometry(1.15, 0.35, 1.15), snow, w * 0.24, h + rh * 0.55 + 1.3, -d * 0.62); }
  // windows: frame, glass that glows at dusk, sill with snow, shutters, a few window boxes
  const winAt = (x, y, ww = 1.1, wh = 1.4, shutters = o.shutters) => {
    add(g, new THREE.BoxGeometry(ww + 0.3, wh + 0.3, 0.16), trim, x, y, 0.06);
    add(g, new THREE.PlaneGeometry(ww, wh), windowGlass, x, y, 0.15).castShadow = false;
    add(g, new THREE.BoxGeometry(0.08, wh, 0.06), trim, x, y, 0.17); add(g, new THREE.BoxGeometry(ww, 0.08, 0.06), trim, x, y, 0.17);
    add(g, new THREE.BoxGeometry(ww + 0.5, 0.14, 0.4), trim, x, y - wh / 2 - 0.2, 0.2); add(g, new THREE.BoxGeometry(ww + 0.4, 0.12, 0.32), snow, x, y - wh / 2 - 0.08, 0.22);
    if (shutters) for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.5, wh + 0.15, 0.1), clay(shutters), x + sx * (ww / 2 + 0.42), y, 0.1);
  };
  for (const [x, y, ww, wh] of o.windows) winAt(x, y, ww, wh);
  // door with step, knob and (optionally) a wreath
  const [dx, dw, dh] = o.door;
  add(g, new THREE.BoxGeometry(dw + 0.35, dh + 0.25, 0.14), trim, dx, dh / 2, 0.05);
  add(g, new THREE.BoxGeometry(dw, dh, 0.12), clay(o.doorColor ?? 0x6b3a26), dx, dh / 2, 0.1);
  add(g, new THREE.SphereGeometry(0.08, 8, 6), clay(0xd9a73a, 'clay', { metalness: 0.4, roughness: 0.4 }), dx + dw * 0.35, dh * 0.48, 0.2);
  add(g, new THREE.BoxGeometry(dw + 1.0, 0.25, 1.0), clay(0x9a8a7a), dx, 0.12, 0.55);
  if (o.wreath) { add(g, new THREE.TorusGeometry(0.42, 0.14, 8, 18), clay(0x2f6a45), dx, dh * 0.72, 0.22); add(g, new THREE.SphereGeometry(0.12, 8, 6), clay(0xc8342c), dx, dh * 0.72 - 0.42, 0.26); }
  if (o.sign) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#f3e7cf'; x.fillRect(0, 0, 512, 96); x.strokeStyle = '#6b3a26'; x.lineWidth = 8; x.strokeRect(4, 4, 504, 88);
    x.fillStyle = '#5a2a1e'; x.font = 'bold 52px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.sign, 256, 52);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    add(g, new THREE.BoxGeometry(Math.min(w - 1, 6.5), 1.2, 0.14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), 0, o.signY ?? h - 0.9, 0.18);
  }
  if (o.awning) {                                                                                                  // striped canvas awning
    const n = 9, aw = o.awning;
    for (let i = 0; i < n; i++) { const s = add(g, new THREE.BoxGeometry(aw / n + 0.01, 0.08, 1.8), clay(i % 2 ? 0xf3e7cf : 0x3f8a5a, 'fabric'), -aw / 2 + (i + 0.5) * aw / n, 3.15, 0.85); s.rotation.x = 0.38; }
    add(g, new THREE.BoxGeometry(aw, 0.18, 1.85), snow, 0, 3.55, 0.75).rotation.x = 0.38;
  }
  if (o.steeple) {
    add(g, new THREE.BoxGeometry(2.4, 5, 2.4), clay(o.wall), 0, h + 2.0, -1.5);
    add(g, new THREE.ConeGeometry(1.9, 4.2, 4), roofM, 0, h + 6.6, -1.5).rotation.y = Math.PI / 4;
    add(g, new THREE.ConeGeometry(1.2, 1.4, 4), snow, 0, h + 5.4, -1.5).rotation.y = Math.PI / 4;
  }
  return g;
}

// the toy drop-off box (same design as the Toy Town journey's): painted crate with a hand-lettered placeholder sign
function dropOffBox() {
  const g = new THREE.Group(), red = clay(0xb8322a), trim = clay(0xf1e3c6), snow = clay(0xf4f1ea, 'snow');
  const W = 1.4, D = 1.0, H = 0.95, t = 0.08;
  add(g, new THREE.BoxGeometry(W, t, D), red, 0, t / 2, 0);
  for (const [w, d, x, z] of [[W, t, 0, D / 2 - t / 2], [W, t, 0, -D / 2 + t / 2], [t, D, W / 2 - t / 2, 0], [t, D, -W / 2 + t / 2, 0]]) add(g, new THREE.BoxGeometry(w, H, d), red, x, H / 2, z);
  add(g, new THREE.BoxGeometry(W + 0.1, 0.1, D + 0.1), trim, 0, H, 0);
  add(g, new THREE.BoxGeometry(W - 2 * t, 0.35, D - 2 * t), clay(0x5a3d2c), 0, 0.22, 0);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#f3e7cf'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#b8322a'; x.lineWidth = 14; x.strokeRect(10, 10, 492, 236);
  x.fillStyle = '#7a1e18'; x.textAlign = 'center'; x.font = 'bold 82px Georgia, serif'; x.fillText('TOY', 256, 108); x.font = 'bold 64px Georgia, serif'; x.fillText('DROP-OFF', 256, 186);
  x.fillStyle = '#c9952e'; x.font = '38px Georgia, serif'; x.fillText('★  new, unwrapped  ★', 256, 232);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  add(g, new THREE.CylinderGeometry(0.04, 0.04, 1.5), trim, 0, 0.75 + 0.1, D / 2 + 0.06);
  add(g, new THREE.PlaneGeometry(1.25, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 1.75, D / 2 + 0.1);
  add(g, new THREE.BoxGeometry(1.3, 0.07, 0.1), snow, 0, 2.09, D / 2 + 0.08);
  return g;
}

export async function createCommunity(scene, siteWorld, { tier = 'high' } = {}) {
  const root = new THREE.Group(); root.position.copy(siteWorld); root.scale.setScalar(S); scene.add(root);
  root.visible = false;

  // ground: a disc of snowy clay with soft drifts; its rim matches the map's snow so the two meet without a seam
  const groundM = clay(0xf1eee8, 'snow');
  // (no ground disc: the map itself is levelled and snowy here, so town and country meet without a seam)
  for (let i = 0; i < 14; i++) { const a = i * 2.39, r = 30 + (i % 4) * 5; const m = add(root, new THREE.SphereGeometry(4 + (i % 3), 16, 10), groundM, Math.cos(a) * r, -3.2, Math.sin(a) * r); m.scale.set(1.5, 0.75, 1.1); }
  const lane = add(root, new THREE.BoxGeometry(70, 0.12, 7.5), clay(0x9a8270, 'cobble'), 0, 0.06, 4);
  for (const z of [-0.2, 8.2]) add(root, new THREE.BoxGeometry(70, 0.3, 1.0), clay(0xb8ab9c), 0, 0.15, z);
  for (let i = 0; i < 40; i++) { const x = -34 + i * 1.75; for (const z of [-0.9, 8.9]) add(root, new THREE.SphereGeometry(0.55 + 0.25 * Math.sin(i * 1.9), 8, 6), groundM, x, 0.1, z).scale.set(1.5, 0.7, 1); }

  // buildings along the street
  const B = (o, x, z, ry) => { const b = building(o); b.position.set(x, 0.02, z); b.rotation.y = ry; root.add(b); return b; };
  const hall = B({ w: 13, h: 6.2, d: 9, wall: 0xd8c29e, roof: 0x7a3b2e, trim: 0xf6eedd, roofH: 4.2, door: [0, 2.2, 3.0], doorColor: 0x3f6b4c, wreath: true, sign: 'COMMUNITY HALL', signY: 5.3,
    windows: [[-4.6, 2.4, 1.6, 2.0], [-2.3, 2.4, 1.2, 2.0], [2.3, 2.4, 1.2, 2.0], [4.6, 2.4, 1.6, 2.0]] }, 0, -2.8, 0);
  B({ w: 9, h: 5.6, d: 7, wall: 0x3d6fa8, roof: 0x5b3a2a, shutters: 0xb8322a, door: [0, 1.4, 2.4], wreath: true, sign: 'GENERAL STORE', signY: 4.55, awning: 8.6, chimney: true,
    windows: [[-2.8, 1.8, 1.8, 1.6], [2.8, 1.8, 1.8, 1.6]] }, -15, -1.8, 0.06);
  B({ w: 7, h: 4.8, d: 6, wall: 0xd98aa0, roof: 0x6b3326, shutters: 0x3f6b4c, door: [-1.4, 1.2, 2.3], windows: [[1.6, 1.8], [-1.6, 3.6], [1.6, 3.6]] }, 13.5, -2.2, -0.05);
  B({ w: 6.4, h: 4.4, d: 6, wall: 0xe2c25a, roof: 0x46604a, shutters: 0x3d6fa8, door: [1.2, 1.2, 2.2], windows: [[-1.4, 1.8], [-1.4, 3.4], [1.4, 3.4]] }, 24.5, -1.6, -0.12);
  B({ w: 6.8, h: 4.6, d: 6, wall: 0x8fb59a, roof: 0x7a3b2e, shutters: 0xf3e7cf, door: [0, 1.2, 2.3], wreath: true, windows: [[-2.0, 2.0], [2.0, 2.0], [0, 3.8, 1.0, 1.0]] }, -10, 15.5, Math.PI + 0.05);
  B({ w: 6.2, h: 4.2, d: 5.8, wall: 0xc8513f, roof: 0x3b3b4a, shutters: 0xf3e7cf, door: [-1.3, 1.2, 2.2], windows: [[1.4, 1.8], [1.4, 3.3], [-1.4, 3.3]] }, 6, 16, Math.PI - 0.06);
  B({ w: 6.6, h: 4.4, d: 6, wall: 0xb59ad0, roof: 0x5b3a2a, shutters: 0x3f6b4c, door: [1.3, 1.2, 2.2], windows: [[-1.4, 1.8], [-1.4, 3.4], [1.4, 3.4]] }, 20, 15.2, Math.PI + 0.1);
  B({ w: 6.2, h: 4.4, d: 6, wall: 0xe59a5a, roof: 0x3b3b4a, shutters: 0x3d6fa8, door: [0, 1.2, 2.2], windows: [[-1.8, 2.0], [1.8, 2.0]] }, -25.5, 14.6, Math.PI - 0.1);
  B({ w: 7, h: 7.5, d: 11, wall: 0xf1e6d2, roof: 0x4a4a5a, trim: 0xe0d2bc, roofH: 3.6, door: [0, 1.8, 3.2], doorColor: 0x7a3b2e, windows: [[-2.3, 3.6, 1.0, 2.6], [2.3, 3.6, 1.0, 2.6]], steeple: true, chimney: false }, -28, -10, 0.25);

  // the collection point: drop-off box at the hall entrance, with a few toys already given
  const box = dropOffBox(); box.position.set(3.4, 0.25, -1.4); box.rotation.y = -0.15; root.add(box);
  const gifts = [[4.8, -0.8, 0xc8342c, 0.6], [5.5, -1.4, 0x2f5f9e, 0.5], [2.1, -0.6, 0xe0b040, 0.45]];
  for (const [x, z, c, s] of gifts) { const gb = add(root, new THREE.BoxGeometry(s, s * 0.8, s), clay(c), x, 0.25 + s * 0.4, z); gb.rotation.y = x; add(gb, new THREE.BoxGeometry(s * 1.02, s * 0.82, s * 0.18), clay(0xf2d27a)); }

  // hand-pressed clay firs: lumpy tiers, each with a drooping cap of snow
  const firGeos = [0, 1, 2].map((v) => {
    const tiers = [], snows = [];
    for (let i = 0; i < 5; i++) {
      const r = 3.0 - i * 0.52, hgt = 2.6 - i * 0.18, y = 1.4 + i * 1.45;
      const c = new THREE.ConeGeometry(r, hgt, 14, 3, true).translate(0, y, 0), p = c.attributes.position;
      for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), yy = p.getY(k), a = Math.atan2(z, x);
        const f = 1 + 0.09 * Math.sin(a * 7 + i * 1.7 + v) + 0.05 * Math.sin(a * 13 + v * 2.1); const droop = (yy < y - hgt * 0.4) ? -0.12 * (1 + Math.sin(a * 5 + i)) : 0;
        p.setXYZ(k, x * f, yy + droop, z * f); }
      c.computeVertexNormals(); tiers.push(c);
      const sn = new THREE.ConeGeometry(r * 0.78, hgt * 0.5, 14, 2, true).translate(0, y + hgt * 0.24, 0), q = sn.attributes.position;
      for (let k = 0; k < q.count; k++) { const x = q.getX(k), z = q.getZ(k), yy = q.getY(k), a = Math.atan2(z, x); const f = 1 + 0.12 * Math.sin(a * 6 + i * 2.3 + v); q.setXYZ(k, x * f, yy - (yy < y + hgt * 0.1 ? 0.1 * Math.abs(Math.sin(a * 9 + i)) : 0), z * f); }
      sn.computeVertexNormals(); snows.push(sn);
    }
    tiers.push(new THREE.CylinderGeometry(0.35, 0.5, 1.6, 8).translate(0, 0.8, 0));
    return { body: mergeGeometries(tiers.map((g) => g.toNonIndexed())), snow: mergeGeometries(snows.map((g) => g.toNonIndexed())) };
  });
  const needles = clay(0x3b6a48), trunk = clay(0x6b4a2e), snowy = clay(0xf4f1ea, 'snow');
  const placeFir = (x, z, s, k) => { const fg = firGeos[k % 3], g = new THREE.Group(); add(g, fg.body, needles); add(g, fg.snow, snowy); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = k * 1.7; root.add(g); return g; };
  const spots = [[-36, -14], [-40, 2], [-33, 22], [-18, 26], [2, 27], [15, 27], [30, 24], [38, 8], [36, -10], [26, -16], [12, -18], [-6, -20], [-17, -15], [-44, -6], [42, 18], [-40, 28], [28, -24], [-24, -24]];
  spots.forEach(([x, z], i) => placeFir(x, z, 0.85 + (i % 4) * 0.12, i));
  const TX = 8.8, TZ = 0.6;
  const tree = placeFir(TX, TZ, 0.95, 2);
  const bulbs = [];
  for (let i = 0; i < 34; i++) { const a = i * 2.4, hh = 1.6 + (i / 34) * 6.8, r = (3.0 - (hh - 1.4) * 0.36) * 0.95 + 0.15;
    const b = add(root, new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: [0xffd27a, 0xff6a5a, 0x7ac8ff][i % 3], emissive: [0xffb040, 0xff4030, 0x50a0ff][i % 3], emissiveIntensity: 0.4 }), TX + Math.cos(a) * r, hh, TZ + Math.sin(a) * r); b.castShadow = false; bulbs.push(b); }
  add(root, new THREE.OctahedronGeometry(0.45), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 1.2 }), TX, 9.3, TZ);

  // street lamps (their light is in world units: distance × S, intensity × S²)
  const lamps = [[-22, 0.4], [-7, 8.6], [6.5, 0.4], [21, 8.6]].map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0.3, z); root.add(g);
    const iron = clay(0x2a2624);
    add(g, new THREE.CylinderGeometry(0.12, 0.18, 4.2, 10), iron, 0, 2.1, 0);
    add(g, new THREE.BoxGeometry(0.7, 0.18, 0.7), iron, 0, 4.25, 0);
    const glass = add(g, new THREE.BoxGeometry(0.55, 0.75, 0.55), new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffb860, emissiveIntensity: 0.2 }), 0, 4.75, 0); glass.castShadow = false;
    add(g, new THREE.ConeGeometry(0.55, 0.45, 4), iron, 0, 5.35, 0).rotation.y = Math.PI / 4;
    add(g, new THREE.ConeGeometry(0.4, 0.22, 4), clay(0xf4f1ea, 'snow'), 0, 5.52, 0).rotation.y = Math.PI / 4;
    const L = new THREE.PointLight(0xffb468, 0, 16 * S, 2); L.position.set(0, 4.7, 0); g.add(L);
    return { glass, L };
  });

  // falling snow (only drawn when the camera is down in the town)
  const NF = tier === 'low' ? 500 : 1400, sp = new Float32Array(NF * 4);
  for (let i = 0; i < NF; i++) sp.set([(Math.random() - 0.5) * 90, Math.random() * 26, (Math.random() - 0.5) * 80, Math.random()], i * 4);
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3)); sgeo.setAttribute('seed', new THREE.BufferAttribute(sp, 4));
  const snowU = { uT: { value: 0 }, uA: { value: 0 }, uPx: { value: 800 } };
  const flakes = new THREE.Points(sgeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: snowU,
    vertexShader: `attribute vec4 seed; uniform float uT, uPx; varying float vA; void main(){ vec3 p = seed.xyz; p.y = mod(p.y - (0.9 + seed.w) * 1.3 * uT, 26.0);
      p.x += 0.5 * sin(uT * (0.5 + seed.w) + seed.w * 30.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = clamp((0.05 + 0.06 * seed.w) * ${S.toFixed(3)} * uPx / -mv.z, 0.8, 40.0); vA = 1.0; }`,
    fragmentShader: 'uniform float uA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(1.0, 0.97, 0.92, smoothstep(1.0, 0.55, d) * 0.85 * uA); }' }));
  flakes.frustumCulled = false; root.add(flakes);

  return {
    root, hall, box, tree, lamps,
    // dusk: 0 = daylight seen from the sky, 1 = blue-hour street with lamps and windows lit
    setDusk(d, t, pxScale) {
      windowGlass.emissiveIntensity = 0.4 + 2.2 * d;
      for (const l of lamps) { l.glass.material.emissiveIntensity = 0.2 + 3.2 * d; l.L.intensity = 60 * S * S * d; }
      bulbs.forEach((b, i) => { b.material.emissiveIntensity = (0.4 + 2.6 * d) * (0.75 + 0.25 * Math.sin(t * 2.2 + i)); });
      snowU.uT.value = t; snowU.uA.value = d; snowU.uPx.value = pxScale; flakes.visible = d > 0.02;
    },
    // a centre and an eye-level pose in world units, for the descent
    streetPose() {
      const c = siteWorld.clone();
      const portrait = innerWidth < innerHeight;     // tall screens: stand further back so the hall, box and tree all fit
      return { target: c.clone().add(V(1.5 * S, 3.2 * S, -2.0 * S)), dist: (portrait ? 24 : 14) * S, el: THREE.MathUtils.degToRad(portrait ? 7 : 5), az: THREE.MathUtils.degToRad(20) };   // standing in the street   // standing in the street, eye level
    },
  };
}
