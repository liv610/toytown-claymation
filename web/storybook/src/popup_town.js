// A small community that pops up out of the illustrated map, like a pop-up book page.
// Every building exists twice: an inked paper cut-out (lying flat on the page, illustration facing up)
// and a clay model that grows backwards out of the cut-out, so the drawing literally gains depth.
// Everything is driven by three numbers, so the transition can be scrubbed frame by frame:
//   setPop(p)    0 = cut-outs lie flat on the page, 1 = all stood up (staggered from the centre, springy)
//   setReal(r)   0 = paper, 1 = clay (cut-outs fade, bodies gain depth, the page turns into snow)
//   setDusk(d)   0 = daylight storybook, 1 = dusk with lit windows and lamps
import * as THREE from 'three';
import { patch } from '../../journey/src/world/diorama.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const springOut = (x) => { x = clamp(x); return 1 - Math.cos(x * Math.PI * 1.35) * Math.exp(-4.2 * x) * (1 - x); };   // 0 → 1 with a small paper-spring overshoot
const INK = '#4a3524';
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// the community (local units ≈ map units; x east, z south toward the viewer)
const BUILDINGS = [
  { kind: 'hall', x: 0, z: -2.5, w: 6.4, h: 3.2, d: 4.2, wall: 0xd8c29e, roof: 0x7a3b2e, ry: 0 },
  { kind: 'house', x: -7.6, z: -5.2, w: 3.6, h: 2.6, d: 3.2, wall: 0x3d6fa8, roof: 0x5b3a2a, ry: 0.28 },
  { kind: 'house', x: 7.4, z: -5.6, w: 3.4, h: 2.8, d: 3.0, wall: 0xd98aa0, roof: 0x6b3326, ry: -0.28 },
  { kind: 'house', x: -12.4, z: 1.2, w: 3.2, h: 2.4, d: 3.0, wall: 0xe2c25a, roof: 0x46604a, ry: 0.62 },
  { kind: 'house', x: 12.2, z: 0.6, w: 3.4, h: 2.5, d: 3.0, wall: 0x8fb59a, roof: 0x7a3b2e, ry: -0.62 },
  { kind: 'church', x: 3.8, z: -12.2, w: 3.2, h: 3.4, d: 5.0, wall: 0xf1e6d2, roof: 0x4a4a5a, ry: -0.08 },
  { kind: 'house', x: -4.2, z: -12.6, w: 3.0, h: 2.4, d: 2.8, wall: 0xc8513f, roof: 0x3b3b4a, ry: 0.12 },
  { kind: 'house', x: 10.5, z: -11.2, w: 2.8, h: 2.2, d: 2.6, wall: 0xb59ad0, roof: 0x5b3a2a, ry: -0.5 },
  { kind: 'house', x: -11, z: -9.8, w: 2.9, h: 2.3, d: 2.7, wall: 0xe59a5a, roof: 0x3b3b4a, ry: 0.5 },
];
const TREES = (() => { const out = []; let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, d = 14.5 + r() * 5.5; out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d * 0.85 - 2, s: 0.8 + r() * 0.6 }); }
  out.push({ x: -3.5, z: 1.4, s: 0.9 }, { x: 4.2, z: 1.6, s: 0.8 });
  return out; })();
const LAMPS = [[-4.6, 2.2], [4.6, 2.2], [0, 6.2]];

function roofH(b) { return b.kind === 'hall' ? b.w * 0.34 : b.w * 0.55; }

// ---------------- the paper cut-out: the building's front, inked like the map
function drawCard(b) {
  const rh = roofH(b), steeple = b.kind === 'church' ? 3.4 : 0;
  const W = b.w + 0.7, H = b.h + rh + steeple + 0.2, px = 96;
  const c = document.createElement('canvas'); c.width = Math.ceil(W * px); c.height = Math.ceil(H * px);
  const g = c.getContext('2d'); g.scale(px, px); g.translate(W / 2, H); g.scale(1, -1);       // y up, origin bottom centre
  g.lineJoin = 'round'; g.lineWidth = 0.07; g.strokeStyle = INK;
  const hw = b.w / 2;
  // wall with a little hatching
  g.fillStyle = hex(b.wall); g.fillRect(-hw, 0, b.w, b.h); g.strokeRect(-hw, 0, b.w, b.h);
  g.save(); g.beginPath(); g.rect(-hw, 0, b.w, b.h); g.clip(); g.strokeStyle = 'rgba(74,53,36,0.22)'; g.lineWidth = 0.03;
  for (let x = -hw - b.h; x < hw; x += 0.35) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + b.h * 0.5, b.h); g.stroke(); } g.restore();
  // roof + snow
  g.beginPath(); g.moveTo(-hw - 0.25, b.h); g.lineTo(0, b.h + rh); g.lineTo(hw + 0.25, b.h); g.closePath(); g.fillStyle = hex(b.roof); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-hw - 0.25, b.h); g.lineTo(0, b.h + rh);
  for (let i = 0; i <= 10; i++) { const t = i / 10, x = -hw - 0.25 + t * (b.w + 0.5); g.lineTo(x, b.h + (t < 0.5 ? t : 1 - t) * 2 * rh - 0.18 - 0.1 * Math.sin(i * 2.1)); }
  g.lineTo(hw + 0.25, b.h); g.lineTo(0, b.h + rh); g.closePath(); g.fillStyle = '#fbf7ef'; g.fill();
  g.beginPath(); g.moveTo(-hw - 0.25, b.h); g.lineTo(0, b.h + rh); g.lineTo(hw + 0.25, b.h); g.stroke();
  if (steeple) { g.fillStyle = hex(b.wall); g.fillRect(-0.6, b.h + rh * 0.6, 1.2, steeple * 0.55); g.strokeRect(-0.6, b.h + rh * 0.6, 1.2, steeple * 0.55);
    g.beginPath(); g.moveTo(-0.8, b.h + rh * 0.6 + steeple * 0.55); g.lineTo(0, b.h + rh + steeple); g.lineTo(0.8, b.h + rh * 0.6 + steeple * 0.55); g.closePath(); g.fillStyle = hex(b.roof); g.fill(); g.stroke(); }
  // windows (warm) and door
  const win = (x, y, w, h) => { g.fillStyle = '#f6c56a'; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.lineWidth = 0.04; g.stroke(); g.lineWidth = 0.07; };
  for (const w of windowsOf(b)) win(...w);
  const [dx, dw, dh] = doorOf(b); g.fillStyle = b.kind === 'hall' ? '#3f6b4c' : '#6b3a26'; g.fillRect(dx, 0, dw, dh); g.strokeRect(dx, 0, dw, dh);
  if (b.kind === 'hall') { g.fillStyle = '#f3e7cf'; g.fillRect(-1.6, b.h - 0.75, 3.2, 0.5); g.strokeRect(-1.6, b.h - 0.75, 3.2, 0.5);
    g.save(); g.scale(1, -1); g.fillStyle = INK; g.font = 'bold 0.3px Georgia'; g.textAlign = 'center'; g.fillText('COMMUNITY HALL', 0, -(b.h - 0.6)); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return { tex: t, W, H };
}
function windowsOf(b) {
  const out = [], ww = 0.55, wh = 0.62;
  if (b.kind === 'hall') { for (const x of [-2.5, -1.4, 1.0, 2.1]) out.push([x - ww / 2 + 0.28, 0.7, ww, wh]); }
  else if (b.kind === 'church') { out.push([-0.32, 1.0, 0.64, 1.2]); }
  else { out.push([-b.w / 2 + 0.45, b.h * 0.5, ww, wh], [b.w / 2 - 0.45 - ww, b.h * 0.5, ww, wh]); if (b.h > 2.45) out.push([-ww / 2, b.h * 0.5 + 0.1 + 0.05, ww * 0.9, wh * 0.8]); }
  return out;
}
function doorOf(b) { return b.kind === 'hall' ? [-0.55, 1.1, 1.7] : b.kind === 'church' ? [-0.5, 1.0, 0.95] : [-0.32 + (b.h > 2.45 ? 0.9 : 0), 0.64, 1.2]; }

// ---------------- the clay body (front face at z = 0, extending to -d)
function buildBody(b, mats) {
  const g = new THREE.Group(), rh = roofH(b);
  const clay = (color, kind = 'clay') => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 }); patch(m, kind); return m; };
  const add = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; g.add(me); return me; };
  add(new THREE.BoxGeometry(b.w, b.h, b.d), clay(b.wall), 0, b.h / 2, -b.d / 2);
  const tri = new THREE.Shape(); tri.moveTo(-b.w / 2 - 0.25, 0); tri.lineTo(0, rh); tri.lineTo(b.w / 2 + 0.25, 0); tri.closePath();
  add(new THREE.ExtrudeGeometry(tri, { depth: b.d + 0.4, bevelEnabled: false }), clay(b.roof), 0, b.h, -b.d - 0.2);   // extrudes +z: overhangs front and back
  const snowTri = new THREE.Shape(); snowTri.moveTo(-b.w / 2 - 0.3, 0.12); snowTri.lineTo(0, rh + 0.16); snowTri.lineTo(b.w / 2 + 0.3, 0.12); snowTri.lineTo(b.w / 2 + 0.05, 0.02); snowTri.lineTo(0, rh - 0.12); snowTri.lineTo(-b.w / 2 - 0.05, 0.02); snowTri.closePath();
  add(new THREE.ExtrudeGeometry(snowTri, { depth: b.d + 0.5, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }), mats.snow, 0, b.h, -b.d - 0.25);
  if (b.kind === 'church') {
    add(new THREE.BoxGeometry(1.2, 3.4 * 0.55 + rh * 0.4, 1.2), clay(b.wall), 0, b.h + rh * 0.6 + (3.4 * 0.55) / 2 - rh * 0.2, -0.8);
    add(new THREE.ConeGeometry(0.95, 3.4 * 0.45, 4), clay(b.roof), 0, b.h + rh + 3.4 * 0.55 + 0.1, -0.8).rotation.y = Math.PI / 4;
  } else if (b.kind !== 'hall') add(new THREE.BoxGeometry(0.45, 1.0, 0.45), clay(0x8a4a3a), b.w * 0.25, b.h + rh * 0.55, -b.d * 0.6);
  for (const [x, y, w, h] of windowsOf(b)) { const me = add(new THREE.PlaneGeometry(w, h), mats.window, x + w / 2, y + h / 2, 0.012); me.castShadow = false; }
  const [dx, dw, dh] = doorOf(b); add(new THREE.BoxGeometry(dw, dh, 0.08), clay(b.kind === 'hall' ? 0x3f6b4c : 0x6b3a26), dx + dw / 2, dh / 2, 0.02);
  if (b.kind === 'hall') {
    add(new THREE.TorusGeometry(0.42, 0.13, 8, 20), clay(0x2f6a45), 0, 2.15, 0.12);
    add(new THREE.BoxGeometry(3.2, 0.5, 0.06), clay(0xf3e7cf), 0, b.h - 0.5, 0.03);
  }
  return g;
}

export function createPopupTown(scene, centre) {
  const root = new THREE.Group(); root.position.copy(centre); scene.add(root);
  const mats = {
    snow: (() => { const m = new THREE.MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.85 }); patch(m, 'snow'); return m; })(),
    window: new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb050, emissiveIntensity: 0.3, roughness: 0.4 }),
  };
  // ---- the snowy ground that replaces the page, spreading out from the centre with a torn-paper edge
  const reveal = { value: 0 };
  const ground = new THREE.Mesh(new THREE.CircleGeometry(24, 96), (() => {
    const m = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 0.9 }); patch(m, 'snow');
    const inner = m.onBeforeCompile;
    m.onBeforeCompile = (sh) => {
      inner(sh); sh.uniforms.uR = reveal;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vLoc;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position.xy;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uR; varying vec2 vLoc;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          { float a = atan(vLoc.y, vLoc.x), d = length(vLoc);
            float edge = uR + 0.9 * sin(a * 7.0) + 0.6 * sin(a * 17.0 + 1.3) + 0.35 * sin(a * 41.0);
            if (d > edge) discard;
            float rim = smoothstep(edge - 0.8, edge, d);          // a curling paper rim at the boundary
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.87, 0.74), rim); }`);
    };
    m.customProgramCacheKey = () => 'tt-snow-reveal';
    return m;
  })());
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.04; ground.receiveShadow = true; root.add(ground);
  // a cobbled lane in front of the hall
  const lane = new THREE.Mesh(new THREE.BoxGeometry(26, 0.06, 2.6), (() => { const m = new THREE.MeshStandardMaterial({ color: 0x9a8270, roughness: 0.9 }); patch(m, 'cobble'); return m; })());
  lane.position.set(0, 0.06, 2.2); lane.receiveShadow = true; root.add(lane);

  // ---- buildings: hinge → (card + body)
  const items = [];
  for (const b of BUILDINGS) {
    const base = new THREE.Group(); base.position.set(b.x, 0.08, b.z); base.rotation.y = b.ry; root.add(base);
    const hinge = new THREE.Group(); base.add(hinge);
    const { tex, W, H } = drawCard(b);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, toneMapped: false }));
    card.position.set(0, H / 2, 0.04); card.castShadow = true; hinge.add(card);
    const body = buildBody(b, mats); body.visible = false; hinge.add(body);
    items.push({ b, base, hinge, card, body, d: Math.hypot(b.x, b.z + 2) });
  }
  // ---- trees: cut-out triangles that become clay firs
  const pine = (() => { const m = new THREE.MeshStandardMaterial({ color: 0x3f6b4c, roughness: 0.85 }); patch(m, 'clay'); return m; })();
  const treeCardTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
    g.fillStyle = '#4c7a55'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 8); g.lineTo(120, 170); g.lineTo(8, 170); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#fbf7ef'; g.lineWidth = 7; g.beginPath(); g.moveTo(36, 90); g.lineTo(64, 8); g.lineTo(92, 90); g.stroke(); g.fillStyle = '#6b4a2e'; g.fillRect(56, 170, 16, 20);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const t of TREES) {
    const base = new THREE.Group(); base.position.set(t.x, 0.08, t.z); root.add(base);
    const hinge = new THREE.Group(); base.add(hinge);
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * t.s, 2.4 * t.s), new THREE.MeshBasicMaterial({ map: treeCardTex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, toneMapped: false }));
    card.position.y = 1.2 * t.s; hinge.add(card);
    const body = new THREE.Group(); body.visible = false; hinge.add(body);
    for (let i = 0; i < 3; i++) { const cone = new THREE.Mesh(new THREE.ConeGeometry((0.85 - i * 0.2) * t.s, 1.0 * t.s, 10), pine); cone.position.y = (0.75 + i * 0.55) * t.s; cone.castShadow = true; body.add(cone);
      const cap = new THREE.Mesh(new THREE.ConeGeometry((0.5 - i * 0.12) * t.s, 0.4 * t.s, 10), mats.snow); cap.position.y = (1.05 + i * 0.55) * t.s; body.add(cap); }
    items.push({ tree: true, base, hinge, card, body, d: Math.hypot(t.x, t.z + 2) });
  }
  // ---- lamps + their light (dusk)
  const lamps = LAMPS.map(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, 0.08, z); root.add(g);
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 0.6 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), iron); post.position.y = 1.1; post.castShadow = true; g.add(post);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb860, emissiveIntensity: 0 })); glass.position.y = 2.35; g.add(glass);
    const L = new THREE.PointLight(0xffb468, 0, 9, 1.6); L.position.y = 2.3; g.add(L);
    g.scale.setScalar(0.001);
    return { g, glass, L };
  });
  // ---- a few winter snowflakes once the town is real
  const NF = 900, sg = new THREE.BufferGeometry(), sp = new Float32Array(NF * 3);
  for (let i = 0; i < NF; i++) sp.set([(Math.random() - 0.5) * 44, Math.random() * 14, (Math.random() - 0.5) * 40], i * 3);
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowU = { uT: { value: 0 }, uA: { value: 0 } };
  const flakes = new THREE.Points(sg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: snowU,
    vertexShader: 'uniform float uT; varying float vA; void main(){ vec3 p = position; p.y = mod(p.y - uT * 1.1, 14.0); p.x += 0.3 * sin(uT + position.z); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 90.0 / -mv.z; vA = 1.0; }',
    fragmentShader: 'uniform float uA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(1.0, 0.97, 0.92, smoothstep(1.0, 0.6, d) * 0.85 * uA); }' }));
  flakes.frustumCulled = false; root.add(flakes);

  const maxD = Math.max(...items.map((i) => i.d));
  let appear = 0, realK = 0;
  const cardAlpha = () => { for (const it of items) { const k = it.k || 0; it.card.material.opacity = appear * (1 - k); it.card.visible = appear > 0.001 && k < 0.999; it.card.material.alphaTest = appear >= 0.999 && k < 0.001 ? 0.02 : 0; } };
  return {
    root, items, lamps,
    setAppear(a) { appear = a; root.visible = a > 0.001; cardAlpha(); },
    setPop(p) {           // staggered from the centre outward, each piece springs up
      for (const it of items) {
        const k = clamp((p * 1.6 - (it.d / maxD) * 0.6) / 1.0);
        it.hinge.rotation.x = -Math.PI / 2 * (1 - springOut(k));
      }
    },
    setReal(r) {          // paper → clay
      for (const it of items) {
        const k = smooth(clamp((r * 1.5 - (it.d / maxD) * 0.5) / 1.0));
        it.body.visible = k > 0.001;
        it.body.scale.z = it.tree ? 1 : 0.03 + 0.97 * k;
        if (it.tree) it.body.scale.setScalar(Math.max(0.001, k));
        it.k = k;
      }
      cardAlpha();
      reveal.value = smooth(r) * 26 - 1;
      ground.visible = r > 0.001; lane.visible = r > 0.45; lane.scale.x = smooth((r - 0.45) / 0.55) + 0.001;
      for (const l of lamps) l.g.scale.setScalar(Math.max(0.001, smooth((r - 0.55) / 0.45)));
    },
    setDusk(d, t) {
      mats.window.emissiveIntensity = 0.3 + 2.6 * d;
      for (const l of lamps) { l.glass.material.emissiveIntensity = 3.5 * d; l.L.intensity = 14 * d; }
      snowU.uT.value = t; snowU.uA.value = d;
    },
  };
}
